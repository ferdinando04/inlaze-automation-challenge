/**
 * Part 3B — Prisma ORM Query: Worst ROAS by Operator
 *
 * Finds campaigns with the worst average ROAS (Return on Ad Spend)
 * in the last 7 days, grouped by operator and ordered ascending
 * (worst performers first).
 *
 * Why this query matters in iGaming:
 * Operators with consistently low ROAS are burning ad budget without
 * generating proportional revenue. This query surfaces them for review
 * so the performance marketing team can pause, optimize, or renegotiate.
 */
import { PrismaClient } from "@prisma/client";
import { createLogger } from "../shared/logger";

const logger = createLogger("prisma-roas-query");

/** Result shape for the worst ROAS analysis */
export interface OperatorRoasResult {
  operatorId: string;
  operatorName: string;
  averageRoas: number;
  campaignCount: number;
}

/**
 * Queries campaigns from the last 7 days, groups by operator,
 * and returns operators sorted by average ROAS ascending (worst first).
 *
 * Uses Prisma's groupBy for the aggregation, then joins operator names
 * in a second query. This two-step approach is clearer than raw SQL
 * and lets Prisma optimize each query independently.
 */
export async function getWorstRoasByOperator(
  prisma?: PrismaClient,
): Promise<OperatorRoasResult[]> {
  const db = prisma ?? new PrismaClient();
  const shouldDisconnect = !prisma;

  try {
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    logger.info("Querying worst ROAS by operator", {
      since: sevenDaysAgo.toISOString(),
    });

    // Step 1: Aggregate ROAS by operator for campaigns in the last 7 days
    const grouped = await db.campaign.groupBy({
      by: ["operatorId"],
      where: {
        reportDate: {
          gte: sevenDaysAgo,
        },
      },
      _avg: {
        roas: true,
      },
      _count: {
        id: true,
      },
      orderBy: {
        _avg: {
          roas: "asc",
        },
      },
    });

    // Step 2: Enrich with operator names
    const operatorIds = grouped.map((g) => g.operatorId);
    const operators = await db.operator.findMany({
      where: { id: { in: operatorIds } },
      select: { id: true, name: true },
    });

    const operatorNameMap = new Map(operators.map((op) => [op.id, op.name]));

    const results: OperatorRoasResult[] = grouped.map((group) => ({
      operatorId: group.operatorId,
      operatorName: operatorNameMap.get(group.operatorId) ?? "Unknown Operator",
      averageRoas: group._avg.roas ?? 0,
      campaignCount: group._count.id,
    }));

    logger.info(`Found ${results.length} operators with campaign data in last 7 days`);

    return results;
  } finally {
    if (shouldDisconnect) {
      await db.$disconnect();
    }
  }
}
