import { tidyName, nameProblem } from "./names";

test("tidyName cleans spaces and fixes all-small / all-capital names", () => {
  expect(tidyName("  amina   juma_")).toBe("Amina Juma");
  expect(tidyName("BARAKA MUSHI")).toBe("Baraka Mushi");
  expect(tidyName("mary-anne o'neil")).toBe("Mary-Anne O'Neil");
  expect(tidyName("Ramadhani McHenry")).toBe("Ramadhani McHenry");   // mixed case kept
  expect(tidyName("")).toBe("");
});

test("nameProblem flags names that look wrong on a certificate", () => {
  expect(nameProblem("", "Amina")).toBe("No name");
  expect(nameProblem("EdwardJacobo42", "EdwardJacobo42")).toBe("Has numbers or symbols");
  expect(nameProblem("AlvinDulle", "AlvinDulle")).toBe("Same as the username");
  expect(nameProblem("amina juma")).toBe("All small letters");
  expect(nameProblem("AMINA JUMA")).toBe("All capital letters");
  expect(nameProblem("Amina")).toBe("Only one name");
  expect(nameProblem("Amina Juma", "Amina2024")).toBe("");
});
