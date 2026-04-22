import { Link } from "react-router-dom";
import { Compass } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Card, CardContent } from "@/components/ui/Card";

export function NotFoundPage() {
  return (
    <div className="min-h-dvh flex items-center justify-center p-4">
      <Card className="max-w-md w-full">
        <CardContent className="p-8 text-center space-y-3">
          <Compass className="h-14 w-14 mx-auto text-accent animate-float" />
          <h1 className="text-3xl font-display gold-text">Sentiero perduto</h1>
          <p className="text-sm text-muted-foreground">
            La mappa non indica questa terra. Torna al Portico e riprendi la quest.
          </p>
          <Button asChild variant="gold">
            <Link to="/">Torna al Portico</Link>
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
