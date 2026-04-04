/**
 * Part 3B — Prisma ORM Query: Worst ROAS by Operator
 *
 * Finds operators with the worst average ROAS (Return on Ad Spend)
 * in the last 7 days, using the CampaignMetric time-series model.
 *
 * Data path: CampaignMetric → Campaign → Operator
 * The query aggregates roas from CampaignMetric (not Campaign),
 * groups by operator, and returns results sorted ascending (worst first).
 */
import { PrismaClient } from "@prisma/client";
import { createLogger } from "../shared/logger";

const logger = createLogger("prisma-roas-query");

/** Result shape for the worst ROAS analysis */
export interface OperatorRoasResult {
  operatorId: string;
  operatorName: string;
  averageRoas: number;
  metricCount: number;
}

/**
 * Queries CampaignMetric records from the last 7 days, groups by operator
 * (navigating CampaignMetric → Campaign → Operator), and returns operators
 * sorted by average ROAS ascending (worst performers first).
 *
 * Uses Prisma's groupBy on CampaignMetric for aggregation, then enriches
 * with operator names via a second query. This two-step approach avoids
 * raw SQL while keeping each query focused and optimizable.
 */
export async function getWorstRoasByOperator(
  prisma?: PrismaClient,
): Promise<OperatorRoasResult[]> {
  const db = prisma ?? new PrismaClient();
  const shouldDisconnect = !prisma;

  try {
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    logger.info("Querying worst ROAS by operator from CampaignMetric", {
      since: sevenDaysAgo.toISOString(),
    });

    // Step 1: Get all recent metrics with their campaign's operatorId
    const metrics = await db.campaignMetric.findMany({
      where: {
        recordedAt: { gte: sevenDaysAgo },
      },
      select: {
        roas: true,
        campaign: {
          select: { operatorId: true },
        },
      },
    });

    // Step 2: Group by operatorId and compute averages in-memory
    // Prisma groupBy can't group by a relation field, so we aggregate manually
    const operatorAggregates = new Map<string, { totalRoas: number; count: number }>();

    for (const metric of metrics) {
      const opId = metric.campaign.operatorId;
      const existing = operatorAggregates.get(opId);
      if (existing) {
        existing.totalRoas += metric.roas;
        existing.count += 1;
      } else {
        operatorAggregates.set(opId, { totalRoas: metric.roas, count: 1 });
      }
    }

    // Step 3: Enrich with operator names
    const operatorIds = Array.from(operatorAggregates.keys());
    const operators = await db.operator.findMany({
      where: { id: { in: operatorIds } },
      select: { id: true, name: true },
    });

    const operatorNameMap = new Map(operators.map((op) => [op.id, op.name]));

    // Step 4: Build results sorted by average ROAS ascending (worst first)
    const results: OperatorRoasResult[] = operatorIds
      .map((opId) => {
        const agg = operatorAggregates.get(opId)!;
        return {
          operatorId: opId,
          operatorName: operatorNameMap.get(opId) ?? "Unknown Operator",
          averageRoas: agg.totalRoas / agg.count,
          metricCount: agg.count,
        };
      })
      .sort((a, b) => a.averageRoas - b.averageRoas);

    logger.info(`Found ${results.length} operators with metric data in last 7 days`);

    return results;
  } finally {
    if (shouldDisconnect) {
      await db.$disconnect();
    }
  }
}
