import { checkWikiAccount } from "./accountCheck";

const fake = (local, global) => async (url) => ({
  json: async () => (url.includes("meta.wikimedia.org") ? { query: { globaluserinfo: global } } : { query: { users: [local] } }),
});

test("found on Swahili Wikipedia", async () => {
  const r = await checkWikiAccount("user:amina_Juma", { fetchImpl: fake({ name: "Amina Juma", userid: 5 }) });
  expect(r).toEqual({ status: "sw", username: "Amina Juma" });
});

test("only a global account (not visited Swahili Wikipedia yet)", async () => {
  const r = await checkWikiAccount("Amina", { fetchImpl: fake({ name: "Amina", missing: true }, { name: "Amina", id: 9 }) });
  expect(r.status).toBe("global");
});

test("no account anywhere → missing; network failure → error", async () => {
  expect((await checkWikiAccount("Amina juma", { fetchImpl: fake({ name: "Amina juma", missing: true }, { missing: true }) })).status).toBe("missing");
  expect((await checkWikiAccount("X", { fetchImpl: async () => { throw new Error("offline"); } })).status).toBe("error");
  expect((await checkWikiAccount("")).status).toBe("missing");
});
