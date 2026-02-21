export default {
    async fetch(request, env, ctx) {
        const url = new URL(request.url);

        // Headers CORS necesarios para que el navegador permita leer el audio
        const corsHeaders = {
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'GET, HEAD, POST, OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type, Range',
            'Access-Control-Expose-Headers': 'Content-Length, Content-Range'
        };

        // Respuesta a la petición OPTIONS (preflight CORS del navegador)
        if (request.method === 'OPTIONS') {
            return new Response(null, {
                headers: corsHeaders
            });
        }

        // Sacamos la ID de la URL (Ejemplo: myworker.dev/123456 o myworker.dev/?id=123456)
        let songId = url.pathname.replace('/', '');
        if (!songId || isNaN(songId)) {
            songId = url.searchParams.get('id');
        }

        if (!songId || isNaN(songId)) {
            return new Response('Por favor, indica una ID de canción válida de Newgrounds.', {
                status: 400,
                headers: corsHeaders
            });
        }

        // Intentar obtener de caché de Cloudflare Edge
        const cache = caches.default;
        const cacheKey = new Request(url.toString(), request);
        let cachedResponse = await cache.match(cacheKey);

        if (cachedResponse) {
            // Si está en caché, le añadimos los CORS extra y la devolvemos
            let response = new Response(cachedResponse.body, cachedResponse);
            for (let [key, value] of Object.entries(corsHeaders)) {
                response.headers.set(key, value);
            }
            return response;
        }

        // Generador de IP falsa aleatoria para intentar evadir los Rate Limits (Error 429)
        const getRandomIP = () => {
            return `${Math.floor(Math.random() * 254) + 1}.${Math.floor(Math.random() * 255)}.${Math.floor(Math.random() * 255)}.${Math.floor(Math.random() * 254) + 1}`;
        };

        const randomIp = getRandomIP();
        const fakeUserAgent = `Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/${Math.floor(Math.random() * 20) + 100}.0.0.0 Safari/537.36`;

        const requestHeaders = {
            'User-Agent': fakeUserAgent,
            'Accept': '*/*',
            'Accept-Language': 'en-US,en;q=0.9',
            'X-Forwarded-For': randomIp,
            'X-Real-IP': randomIp,
            'Client-IP': randomIp,
            'True-Client-IP': randomIp
        };

        // Lista de proxies y urls directas para rotar y evitar bloqueos (429)
        const fetchMethods = [
            `https://www.newgrounds.com/audio/download/${songId}`,
            `https://api.codetabs.com/v1/proxy?quest=https://www.newgrounds.com/audio/download/${songId}`,
            `https://corsproxy.io/?https://www.newgrounds.com/audio/download/${songId}`,
            `https://corsproxy.org/?https%3A%2F%2Fwww.newgrounds.com%2Faudio%2Fdownload%2F${songId}`,
            `https://api.allorigins.win/raw?url=${encodeURIComponent(`https://www.newgrounds.com/audio/download/${songId}`)}`
        ];

        // Mezclamos la lista para que sea aleatoria en cada recarga
        fetchMethods.sort(() => Math.random() - 0.5);

        let ngResponse = null;
        let isSuccess = false;

        try {
            // Intentamos las diferentes rutas una a una hasta que una funcione auténticamente
            for (let urlToTry of fetchMethods) {
                try {
                    ngResponse = await fetch(urlToTry, {
                        headers: requestHeaders
                    });

                    // Comprobamos que el status sea válido
                    if (!ngResponse.ok || ngResponse.status === 429) continue;

                    // Comprobamos el tipo de contenido. Si Newgrounds devuelve NG Guard, será text/html
                    const contentType = ngResponse.headers.get('content-type') || '';
                    if (contentType.toLowerCase().includes('text/html')) {
                        // Nos acaba de interceptar el NG Guard bot protection, descartamos esta ruta.
                        continue;
                    }

                    // Si pasamos los filtros, ¡tenemos el audio de verdad!
                    isSuccess = true;
                    break;
                } catch (err) {
                    continue; // Fallo de red temporal con este proxy, intentar el siguiente
                }
            }

            if (!isSuccess || !ngResponse) {
                return new Response('Newgrounds (y los proxies de respaldo) fallaron o devolvieron NG Guard (Bot Protection).', { status: 502, headers: corsHeaders });
            }

            // Creamos la nueva respuesta basándonos en el cuerpo (audio) de la original
            let newResponse = new Response(ngResponse.body, {
                status: 200,
                headers: {
                    'Content-Type': ngResponse.headers.get('Content-Type') || 'audio/mpeg',
                    'Cache-Control': 'public, max-age=31536000' // Caché de 1 año
                }
            });

            // Guardar en la caché (waitUntil evita que el worker se cierre antes de guardar)
            ctx.waitUntil(cache.put(cacheKey, newResponse.clone()));

            // Finalmente, le añadimos los permisos CORS para el jugador
            for (let [key, value] of Object.entries(corsHeaders)) {
                newResponse.headers.set(key, value);
            }

            return newResponse;

        } catch (e) {
            return new Response('Error al intentar contactar con Newgrounds: ' + e.message, {
                status: 500,
                headers: corsHeaders
            });
        }
    }
};
