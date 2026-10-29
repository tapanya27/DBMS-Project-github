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
      <h2 className="text-xl font-semibold">{title}</h2>
      {rows.length === 0 ? (
        <p className="text-sm text-muted-foreground">No rows yet.</p>
      ) : (
        <div className="overflow-x-auto rounded-md border">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/40">
                {columns.map((column) => (
                  <th key={column} className="px-3 py-2 text-left font-medium">
                    {column.replaceAll("_", " ")}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((row, index) => (
                <tr key={index} className="border-b last:border-0">
                  {columns.map((column) => (
                    <td key={column} className="px-3 py-2">
                      {String(row[column] ?? "")}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

export default async function ReportsPage() {
  const reports = await getReports();
  return (
    <div className="container mx-auto space-y-8 py-8">
      <div>
        <h1 className="text-3xl font-bold">Database reports</h1>
        <p className="text-muted-foreground">
          These tables are PostgreSQL views and the status audit log.
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
