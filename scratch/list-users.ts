import { db } from "../src/server/clients/db";

async function main() {
  const users = await db.user.findMany({
    include: {
      accounts: true,
    },
  });

  console.log(`Found ${users.length} user(s):`);
  for (const user of users) {
    console.log(`User: ${user.username} (${user.email})`);
    for (const acc of user.accounts) {
      console.log(`  Account ID: ${acc.id}`);
      console.log(`  Provider: ${acc.providerId}`);
      console.log(`  Password Hash (first 20 chars): ${acc.password ? acc.password.substring(0, 20) + "..." : "null"}`);
      console.log(`  Password Length: ${acc.password ? acc.password.length : 0}`);
    }
  }
}

main()
  .catch(console.error)
  .finally(() => db.$disconnect());
