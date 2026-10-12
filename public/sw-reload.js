/* The installed app keeps its old page until something reloads it.
   This runs inside the new worker, so a phone still on the previous
   shell picks up the deploy that just activated. */
self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      await self.clients.claim();
      const windows = await self.clients.matchAll({
        type: "window",
        includeUncontrolled: true,
      });
      await Promise.all(
        windows.map((client) => {
          if (!client.url) return undefined;
          const url = new URL(client.url);
          if (url.searchParams.has("sw")) return undefined;
          url.searchParams.set("sw", "1");
          return client.navigate(url.toString());
        }),
      );
    })(),
  );
});
