import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";

export default function ContactPage() {
  return (
    <div className="section-y page-container">
      <div className="mx-auto max-w-2xl space-y-8">
        <header className="space-y-2 text-center">
          <h1 className="text-3xl font-semibold tracking-tight">Contact</h1>
          <p className="text-sm text-muted-foreground">
            Questions about Contractix? Send a message.
          </p>
        </header>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Message</CardTitle>
          </CardHeader>
          <CardContent>
            <form className="space-y-4">
              <div className="space-y-2">
                <label htmlFor="name" className="text-sm font-medium">
                  Name
                </label>
                <Input id="name" placeholder="Your name" />
              </div>
              <div className="space-y-2">
                <label htmlFor="email" className="text-sm font-medium">
                  Email
                </label>
                <Input
                  id="email"
                  type="email"
                  placeholder="you@example.com"
                />
              </div>
              <div className="space-y-2">
                <label htmlFor="subject" className="text-sm font-medium">
                  Subject
                </label>
                <Input id="subject" placeholder="How can we help?" />
              </div>
              <div className="space-y-2">
                <label htmlFor="message" className="text-sm font-medium">
                  Message
                </label>
                <Textarea
                  id="message"
                  placeholder="Write your message…"
                  rows={5}
                />
              </div>
              <Button type="submit" className="w-full sm:w-auto">
                Send message
              </Button>
            </form>
          </CardContent>
        </Card>

        <div className="grid gap-4 text-sm sm:grid-cols-2">
          <div className="rounded-lg border bg-card p-4">
            <p className="font-medium">Email</p>
            <p className="mt-1 text-muted-foreground">support@contractix.com</p>
          </div>
          <div className="rounded-lg border bg-card p-4">
            <p className="font-medium">Hours</p>
            <p className="mt-1 text-muted-foreground">Mon–Fri, 9am–5pm</p>
          </div>
        </div>
      </div>
    </div>
  );
}
