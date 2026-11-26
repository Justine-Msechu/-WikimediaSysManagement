import { headerLabels, labelCells } from "./responsiveTables";

test("labelCells gives each body cell its column name; spanning cells get none", () => {
  document.body.innerHTML = `
    <table>
      <thead><tr><th>Name</th><th colspan="2">Contact</th><th>Status</th></tr></thead>
      <tbody>
        <tr><td colspan="4">Existing members (1)</td></tr>
        <tr><td>Amina</td><td>a@x.org</td><td>0700</td><td>Recommended</td></tr>
      </tbody>
    </table>`;
  const table = document.querySelector("table");
  expect(headerLabels(table)).toEqual(["Name", "Contact", "Contact", "Status"]);
  labelCells(table);
  const rows = table.tBodies[0].rows;
  expect(rows[0].cells[0].getAttribute("data-label")).toBe("");
  expect([...rows[1].cells].map(td => td.getAttribute("data-label"))).toEqual(["Name", "Contact", "Contact", "Status"]);
});

test("tables without a header are left alone", () => {
  document.body.innerHTML = `<table><tbody><tr><td>x</td></tr></tbody></table>`;
  const table = document.querySelector("table");
  labelCells(table);
  expect(table.querySelector("td").hasAttribute("data-label")).toBe(false);
});
