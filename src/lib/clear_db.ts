```
import { getPool } from "@/lib/storage";

(async () => {
  try {
    const client = await getPool();
    await client.query(`DELETE FROM media;`);
    console.log("All media rows deleted from Postgres.");
  } catch (e) {
    console.error("Error deleting media rows:", e);
  }
})();
```
