import { LogOut } from "lucide-react";
import { signOutAction } from "@/app/(app)/actions";
import { Button } from "@/components/ui/button";

export function SignOutButton() {
  return (
    <form action={signOutAction}>
      <Button variant="ghost" size="icon" type="submit" aria-label="Sign out">
        <LogOut />
      </Button>
    </form>
  );
}
