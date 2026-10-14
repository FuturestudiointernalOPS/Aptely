import { paginate, generateShareLink } from "@/utils/helpers";

describe("paginate", () => {
  it("defaults to page 1 and limit 10", () => {
    expect(paginate(undefined, undefined)).toEqual({ offset: 0, limit: 10 });
  });

  it("derives offset from page and limit", () => {
    expect(paginate("3", "20")).toEqual({ offset: 40, limit: 20 });
  });

  it("clamps limit to 100 and page to a minimum of 1", () => {
    expect(paginate("0", "500")).toEqual({ offset: 0, limit: 100 });
  });

  it("honours a custom default limit", () => {
    expect(paginate(undefined, undefined, 25)).toEqual({ offset: 0, limit: 25 });
  });
});

describe("generateShareLink", () => {
  it("returns a prefixed slug without a full URL", () => {
    const slug = generateShareLink("role");
    expect(slug).toMatch(/^role-[A-Za-z0-9_-]+$/);
  });

  it("produces distinct slugs", () => {
    expect(generateShareLink("role")).not.toEqual(generateShareLink("role"));
  });
});
