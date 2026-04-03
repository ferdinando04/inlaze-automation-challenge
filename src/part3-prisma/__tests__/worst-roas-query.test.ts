import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { PrismaClient } from "@prisma/client";
import { getWorstRoasByOperator } from "../worst-roas-query";

const prisma = new PrismaClient();

beforeAll(async () => {
  // Seed test data: 2 operators, multiple campaigns in last 7 days
  const now = new Date();
  const daysAgo = (n: number) => new Date(now.getTime() - n * 24 * 60 * 60 * 1000);

  const operatorA = await prisma.operator.create({
    data: { name: "Operator Alpha" },
  });

  const operatorB = await prisma.operator.create({
    data: { name: "Operator Beta" },
  });

  // Operator Alpha: avg ROAS = (0.5 + 1.0 + 0.8) / 3 = 0.767
  await prisma.campaign.createMany({
    data: [
      { name: "Alpha Camp 1", spend: 1000, revenue: 500, roas: 0.5, operatorId: operatorA.id, reportDate: daysAgo(1) },
      { name: "Alpha Camp 2", spend: 1000, revenue: 1000, roas: 1.0, operatorId: operatorA.id, reportDate: daysAgo(2) },
      { name: "Alpha Camp 3", spend: 1000, revenue: 800, roas: 0.8, operatorId: operatorA.id, reportDate: daysAgo(3) },
      // This one is > 7 days ago — should be excluded from the query
      { name: "Alpha Old Camp", spend: 1000, revenue: 5000, roas: 5.0, operatorId: operatorA.id, reportDate: daysAgo(10) },
    ],
  });

  // Operator Beta: avg ROAS = (2.0 + 3.0) / 2 = 2.5
  await prisma.campaign.createMany({
    data: [
      { name: "Beta Camp 1", spend: 1000, revenue: 2000, roas: 2.0, operatorId: operatorB.id, reportDate: daysAgo(1) },
      { name: "Beta Camp 2", spend: 1000, revenue: 3000, roas: 3.0, operatorId: operatorB.id, reportDate: daysAgo(4) },
    ],
  });
});

afterAll(async () => {
  // Cleanup test data in correct order (campaigns reference operators)
  await prisma.campaign.deleteMany();
  await prisma.operator.deleteMany();
  await prisma.$disconnect();
});

describe("getWorstRoasByOperator", () => {
  it("returns operators ordered by worst (lowest) average ROAS", async () => {
    const results = await getWorstRoasByOperator(prisma);

    expect(results.length).toBeGreaterThanOrEqual(2);
    // Operator Alpha should appear first (worst ROAS ≈ 0.767)
    expect(results[0].operatorName).toBe("Operator Alpha");
    // Operator Beta second (ROAS = 2.5)
    expect(results[1].operatorName).toBe("Operator Beta");
  });

  it("only includes campaigns from the last 7 days", async () => {
    const results = await getWorstRoasByOperator(prisma);

    // Alpha's old campaign (ROAS 5.0, 10 days ago) should NOT be included
    // If it were, Alpha's avg would be (0.5+1.0+0.8+5.0)/4 = 1.825, not 0.767
    const alphaResult = results.find((r) => r.operatorName === "Operator Alpha");
    expect(alphaResult).toBeDefined();
    expect(alphaResult!.averageRoas).toBeCloseTo(0.767, 1);
  });

  it("orders from lowest to highest average ROAS", async () => {
    const results = await getWorstRoasByOperator(prisma);

    for (let i = 1; i < results.length; i++) {
      expect(results[i].averageRoas).toBeGreaterThanOrEqual(results[i - 1].averageRoas);
    }
  });
});
