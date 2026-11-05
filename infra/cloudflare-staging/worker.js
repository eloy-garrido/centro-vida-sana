// Bootstrap exclusivo de pruebas. No sirve el sitio ni admite reservas.
export default {
  async fetch() {
    return new Response(JSON.stringify({ status: "not_configured" }), {
      status: 503,
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        "Cache-Control": "private, no-store",
        "X-Robots-Tag": "noindex, nofollow",
      },
    });
  },
};
