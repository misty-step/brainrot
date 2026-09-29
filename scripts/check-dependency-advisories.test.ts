import { describe, expect, it } from "vitest";

import { baselineGrowth, diffAdvisories } from "./check-dependency-advisories";

// Shaped like `pnpm audit --json` on the MIS-191 lockfile: ip-address 10.1.0
// is locked under puppeteer > proxy-agent > socks-proxy-agent > socks, which
// allows ^10.0.1, so only the lockfile holds it below the patched 10.3.1.
const ipAddressReport = {
  advisories: {
    "1116001": {
      id: 1116001,
      github_advisory_id: "GHSA-mwp4-54f8-5fhr",
      module_name: "ip-address",
      severity: "high",
      vulnerable_versions: "<=10.3.0",
      patched_versions: ">=10.3.1",
      title: "Address4 decodes leading-zero octets as decimal",
    },
  },
  actions: [
    {
      resolves: [
        {
          id: 1116001,
          path: "apps__web>puppeteer>puppeteer-core>@puppeteer/browsers>proxy-agent>socks-proxy-agent>socks>ip-address",
        },
      ],
    },
  ],
};

const ipAddressKey = "GHSA-mwp4-54f8-5fhr ip-address";

describe("diffAdvisories", () => {
  it("rejects a locked transitive advisory that is not baselined, naming its fix", () => {
    const { fresh, stale } = diffAdvisories(ipAddressReport, []);

    expect(stale).toEqual([]);
    expect(fresh).toHaveLength(1);
    expect(fresh[0].key).toBe(ipAddressKey);
    expect(fresh[0].line).toContain("(patched: >=10.3.1)");
    expect(fresh[0].line).toContain("socks>ip-address");
  });

  it("accepts an advisory that is already baselined", () => {
    expect(diffAdvisories(ipAddressReport, [ipAddressKey])).toEqual({
      fresh: [],
      stale: [],
    });
  });

  it("rejects a baselined advisory that no longer applies, so the baseline only shrinks", () => {
    const diff = diffAdvisories({ advisories: {} }, [ipAddressKey]);

    expect(diff.fresh).toEqual([]);
    expect(diff.stale).toEqual([ipAddressKey]);
  });

  it("throws on a report without advisories so an unavailable audit cannot pass", () => {
    expect(() => diffAdvisories({ error: { code: "ENOTFOUND" } }, [])).toThrow(
      "no advisories",
    );
    expect(() => diffAdvisories(null, [])).toThrow("no advisories");
    expect(() => diffAdvisories({ advisories: [] }, [])).toThrow(
      "no advisories",
    );
  });
});

describe("baselineGrowth", () => {
  it("reports only entries the base branch does not list, so silencing an advisory fails", () => {
    expect(baselineGrowth(["a undici", ipAddressKey], ["a undici"])).toEqual([
      ipAddressKey,
    ]);
    expect(baselineGrowth(["a undici"], ["a undici", ipAddressKey])).toEqual(
      [],
    );
  });
});
