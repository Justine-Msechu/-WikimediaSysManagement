import { sanitizeHtml } from "./sanitizeHtml";

test("keeps simple formatting", () => {
  expect(sanitizeHtml("<strong>Bold</strong> and <em>it</em><ul><li>a</li></ul><br>"))
    .toBe("<strong>Bold</strong> and <em>it</em><ul><li>a</li></ul><br>");
  expect(sanitizeHtml('<a href="https://sw.wikipedia.org">wiki</a>'))
    .toBe('<a href="https://sw.wikipedia.org" target="_blank" rel="noopener noreferrer">wiki</a>');
});

test("removes scripts, event handlers, styles and javascript: links", () => {
  expect(sanitizeHtml('<img src=x onerror="alert(1)">Hi')).toBe("Hi");
  expect(sanitizeHtml("<script>alert(1)</script>ok")).toBe("ok");
  expect(sanitizeHtml('<p onclick="x()" style="color:red">t</p>')).toBe("<p>t</p>");
  expect(sanitizeHtml('<a href="javascript:alert(1)">x</a>')).toBe("<a>x</a>");
  expect(sanitizeHtml('<a href=" java\tscript:alert(1)">x</a>')).toBe("<a>x</a>");
  expect(sanitizeHtml('<a href="//evil.example">x</a>')).toBe("<a>x</a>");
  expect(sanitizeHtml('<svg><script>alert(1)</script></svg><iframe src="x"></iframe>z')).toBe("z");
  expect(sanitizeHtml("<custom-tag>kept text</custom-tag>")).toBe("kept text");
});
