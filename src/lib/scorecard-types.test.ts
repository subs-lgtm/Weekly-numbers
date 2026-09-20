import { describe, it, expect } from "vitest"
import { getBand, isReasonRequired, validateRules, DEFAULT_RULES, type ScorecardRules } from "./scorecard-types"

describe("getBand", () => {
  it("uses default rules (green>=8, red<6, yellow 6-7)", () => {
    expect(getBand(10, DEFAULT_RULES)).toBe("green")
    expect(getBand(8, DEFAULT_RULES)).toBe("green")
    expect(getBand(7, DEFAULT_RULES)).toBe("yellow")
    expect(getBand(6, DEFAULT_RULES)).toBe("yellow")
    expect(getBand(5, DEFAULT_RULES)).toBe("red")
    expect(getBand(1, DEFAULT_RULES)).toBe("red")
  })

  it("collapses yellow entirely when red_below === green_from", () => {
    const rules: ScorecardRules = { ...DEFAULT_RULES, green_from: 7, red_below: 7 }
    expect(getBand(8, rules)).toBe("green")
    expect(getBand(7, rules)).toBe("green")
    expect(getBand(6, rules)).toBe("red")
  })
})

describe("isReasonRequired", () => {
  it("required strictly below the threshold, not at it", () => {
    expect(isReasonRequired(9, DEFAULT_RULES)).toBe(true)
    expect(isReasonRequired(10, DEFAULT_RULES)).toBe(false)
  })
})

describe("validateRules", () => {
  it("accepts a normal update", () => {
    expect(validateRules({ green_from: 8, red_below: 6 })).toEqual({ valid: true })
  })

  it("rejects red_below > green_from", () => {
    expect(validateRules({ green_from: 6, red_below: 8 }).valid).toBe(false)
  })

  it("accepts red_below === green_from (no yellow band)", () => {
    expect(validateRules({ green_from: 7, red_below: 7 })).toEqual({ valid: true })
  })

  it("rejects out-of-range values", () => {
    expect(validateRules({ green_from: 1 }).valid).toBe(false)
    expect(validateRules({ green_from: 11 }).valid).toBe(false)
    expect(validateRules({ red_below: 0 }).valid).toBe(false)
  })

  it("rejects non-integers", () => {
    expect(validateRules({ green_from: 7.5 }).valid).toBe(false)
  })
})
