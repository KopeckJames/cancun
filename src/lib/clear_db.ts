import { sql } from "@vercel/postgres";

(async () => {
  try {
    await sql`DELETE FROM media;`;
    console.log("All media rows deleted from Postgres.");
  } catch (e) {
    console.error("Error deleting media rows:", e);
  }
})();
