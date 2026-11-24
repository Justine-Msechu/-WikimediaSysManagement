import { personKey, groupPeople, bestName, peopleCounts } from "./participantPeople";

const rec = (id, name, wikimediaUsername, extra = {}) => ({ id, name, wikimediaUsername, ...extra });

test("same username in different case / underscores / User: prefix is one person", () => {
  expect(personKey({ wikimediaUsername: "amina_juma" })).toBe(personKey({ wikimediaUsername: "User:Amina Juma" }));
  expect(personKey({ wikimediaUsername: "Amina JUMA" })).toBe(personKey({ wikimediaUsername: "amina juma" }));
  expect(personKey({ email: "A@X.tz" })).toBe(personKey({ email: "a@x.tz " }));
  expect(personKey({ name: "  baraka  MUSHI" })).toBe(personKey({ name: "Baraka Mushi" }));
});

test("bestName prefers a tidy full name", () => {
  expect(bestName(["AMINA JUMA", "amina", "amina juma"])).toBe("Amina Juma");
  expect(bestName(["Baraka"])).toBe("Baraka");
});

test("groupPeople: one person per username, returning after 2+ events, spelling fixes", () => {
  const people = groupPeople([
    rec("1", "amina juma", "Amina_Juma", { formId: "f1", isNew: true, createdAt: { seconds: 1 } }),
    rec("2", "AMINA JUMA", "amina juma", { formId: "f2", createdAt: { seconds: 2 } }),
    rec("3", "Amina Juma", "Amina Juma", { formId: "f2", createdAt: { seconds: 3 } }),   // same event twice
    rec("4", "Baraka Mushi", "Baraka", { formId: "f1" }),
  ]);
  const amina = people[0];
  expect(amina).toMatchObject({ name: "Amina Juma", username: "Amina Juma", events: 2, returning: true, isNew: true, needsFix: true });
  expect(amina.records.map(r => r.id)).toEqual(["1", "2", "3"]);
  expect(amina.sameEventDuplicates.map(l => l.map(r => r.id))).toEqual([["2", "3"]]);
  expect(people[1]).toMatchObject({ name: "Baraka Mushi", returning: false, needsFix: false });
});

test("peopleCounts counts editors as people", () => {
  const c = peopleCounts([
    rec("1", "Amina", "Amina", { formId: "f1", isNew: true }),
    rec("2", "amina", "amina", { formId: "f2" }),
    rec("3", "Baraka M", "Baraka", { formId: "f1" }),
    rec("4", "Dora K", "", { formId: "f1", email: "d@x.tz" }),
  ]);
  expect(c).toEqual({ records: 4, people: 3, editors: 2, newEditors: 1, returning: 1, retained: 2 });
});
