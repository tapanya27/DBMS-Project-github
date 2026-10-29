import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function AboutPage() {
  return (
    <div className="section-y page-container">
      <div className="mx-auto max-w-2xl space-y-8">
        <header className="space-y-2 text-center">
          <h1 className="text-3xl font-semibold tracking-tight">
            About Contractix
          </h1>
          <p className="text-sm text-muted-foreground">
            A marketplace connecting clients and freelancers with clear jobs,
            bids, and feedback.
          </p>
        </header>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Mission</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm leading-relaxed text-muted-foreground">
              Contractix helps businesses find skilled freelancers and helps
              freelancers find paid work—with transparent bidding, secure
              messaging, and structured feedback.
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">How it works</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm text-muted-foreground">
            <p>
              <span className="font-medium text-foreground">Clients</span> post
              jobs, review bids, accept a freelancer, and leave feedback when
              work is done.
            </p>
            <p>
              <span className="font-medium text-foreground">Freelancers</span>{" "}
              browse open jobs, submit bids, deliver work, and build a rating
              over time.
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
