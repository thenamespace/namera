// import { readMigrationFiles } from "drizzle-orm/migrator";
// import { drizzle } from "drizzle-orm/node-postgres";
// import { migrate } from "drizzle-orm/pg-core";

export * from "./core";
export * from "./schema";
export * from "./config";

// const runMigrations = async () => {
//   const migrations = readMigrationFiles({
//     migrationsFolder: "./drizzle-migrations",
//   });

//   const db = drizzle({
//     connection: {
//       host: "localhost",
//       port: 5432,
//       user: "namera",
//       password: "namera",
//       database: "namera",
//       ssl: false,
//     },
//   });
//   const res = await migrate(migrations, db, {
//     migrationsFolder: "./drizzle-migrations",
//   });

//   console.log(res);
// };

// runMigrations();
