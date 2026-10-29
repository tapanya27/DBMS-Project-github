import { getReports } from "@/server";

function ReportTable({
  title,
  rows,
}: {
  title: string;
  rows: any[];
}) {
  const columns = rows[0] ? Object.keys(rows[0]) : [];
  return (
    <section className="space-y-3">
      <h2 className="text-base font-semibold sm:text-lg">{title}</h2>
      {rows.length === 0 ? (
        <p className="rounded-lg border border-dashed bg-muted/30 px-4 py-8 text-sm text-muted-foreground">
          No rows yet.
        </p>
      ) : (
        <div className="-mx-4 overflow-x-auto px-4 sm:mx-0 sm:px-0">
          <div className="min-w-[520px] overflow-hidden rounded-xl border">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/40">
                  {columns.map((column) => (
                    <th
                      key={column}
                      className="px-3 py-2.5 text-left text-xs font-medium uppercase tracking-wide text-muted-foreground"
                    >
                      {column.replaceAll("_", " ")}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map((row, index) => (
                  <tr key={index} className="border-b last:border-0">
                    {columns.map((column) => (
                      <td
                        key={column}
                        className="max-w-[220px] px-3 py-2.5 break-words-safe"
                      >
                        {String(row[column] ?? "")}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </section>
  );
}

export default async function ReportsPage() {
  const reports = await getReports();
  return (
    <div className="section-y page-container space-y-8">
      <div className="max-w-2xl space-y-2">
        <h1 className="text-2xl font-semibold sm:text-3xl">Reports</h1>
        <p className="text-sm text-muted-foreground sm:text-base">
          Live results from PostgreSQL views and the status audit log.
        </p>
      </div>
      <ReportTable title="Open jobs" rows={reports.openJobs} />
      <ReportTable title="Average bid versus budget" rows={reports.bidVsBudget} />
      <ReportTable title="Freelancers by rating" rows={reports.freelancerRank} />
      <ReportTable title="Clients with completed jobs" rows={reports.topClients} />
      <ReportTable title="Jobs with no bids" rows={reports.jobsWithoutBids} />
      <ReportTable title="Jobs by month" rows={reports.monthly} />
      <ReportTable title="Recent status changes" rows={reports.audit} />
    </div>
  );
}
