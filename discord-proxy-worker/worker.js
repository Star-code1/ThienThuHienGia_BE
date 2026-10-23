export default {
  async fetch(request, env, ctx) {
    // 1. Xử lý preflight CORS (OPTIONS)
    if (request.method === 'OPTIONS') {
      return new Response(null, {
        status: 204,
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, PATCH, OPTIONS',
          'Access-Control-Allow-Headers': '*',
          'Access-Control-Max-Age': '86400',
        },
      });
    }

    const url = new URL(request.url);

    // 2. Health-check / trang chủ kiểm tra proxy
    if (url.pathname === '/' || url.pathname === '') {
      return new Response(
        JSON.stringify(
          {
            status: 'online',
            service: 'Discord API Reverse Proxy (Cloudflare Worker)',
            message: 'Proxy is working normally!',
            instructions: `Đặt biến DISCORD_API_BASE_URL trên Render/Backend thành: ${url.origin}/api/v10`,
          },
          null,
          2
        ),
        {
          status: 200,
          headers: {
            'Content-Type': 'application/json; charset=utf-8',
            'Access-Control-Allow-Origin': '*',
          },
        }
      );
    }

    try {
      // 3. Chuẩn hóa path tới Discord API (Tự động thêm /api/v10 nếu thiếu)
      let targetPath = url.pathname;
      if (!targetPath.startsWith('/api')) {
        targetPath = `/api/v10${targetPath.startsWith('/') ? targetPath : '/' + targetPath}`;
      }

      const targetUrl = new URL(targetPath + url.search, 'https://discord.com');

      // 4. Chuẩn bị headers chuyển tiếp
      const forwardHeaders = new Headers(request.headers);

      // Xóa các headers gây nhiễu của Cloudflare Worker
      forwardHeaders.delete('host');
      forwardHeaders.delete('cf-connecting-ip');
      forwardHeaders.delete('cf-ipcountry');
      forwardHeaders.delete('cf-ray');
      forwardHeaders.delete('cf-visitor');

      // Gán User-Agent hợp lệ theo chuẩn Discord Developer Terms
      if (
        !forwardHeaders.has('User-Agent') ||
        forwardHeaders.get('User-Agent').includes('Cloudflare')
      ) {
        forwardHeaders.set(
          'User-Agent',
          'DiscordBot (https://github.com/Star-code1/ThienThuHienGia_BE, 1.0.0)'
        );
      }

      const fetchOptions = {
        method: request.method,
        headers: forwardHeaders,
        redirect: 'follow',
      };

      // Chỉ đính kèm body đối với các method được phép (không phải GET hoặc HEAD)
      if (request.method !== 'GET' && request.method !== 'HEAD') {
        fetchOptions.body = request.body;
      }

      // 5. Gửi request sang Discord API qua Cloudflare Edge IP sạch
      const response = await fetch(targetUrl.toString(), fetchOptions);

      // 6. Trả kết quả về cho Backend kèm header CORS
      const responseHeaders = new Headers(response.headers);
      responseHeaders.set('Access-Control-Allow-Origin', '*');
      responseHeaders.set('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, PATCH, OPTIONS');
      responseHeaders.set('Access-Control-Allow-Headers', '*');

      const hasResponseBody = response.status !== 204 && response.status !== 304;

      return new Response(hasResponseBody ? response.body : null, {
        status: response.status,
        statusText: response.statusText,
        headers: responseHeaders,
      });
    } catch (err) {
      return new Response(
        JSON.stringify(
          {
            error: 'Discord Proxy Error',
            message: err.message,
          },
          null,
          2
        ),
        {
          status: 502,
          headers: {
            'Content-Type': 'application/json; charset=utf-8',
            'Access-Control-Allow-Origin': '*',
          },
        }
      );
    }
  },
};
