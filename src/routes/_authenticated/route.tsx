import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";

import { AppSidebar, MobileNav } from "@/components/app-sidebar";
import { GlobalFeatureToast } from "@/components/global-feature-toast";
import { NewsUpdatesSheet } from "@/components/news-updates-sheet";
import { OnboardingDialog } from "@/components/onboarding-dialog";
import { WhatsNewNotifier } from "@/components/whats-new-notifier";
import { supabase } from "@/integrations/supabase/client";
import { useProvisionAccount } from "@/lib/provision";

export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  beforeLoad: async () => {
    const { data, error } = await supabase.auth.getUser();
    if (error || !data.user) throw redirect({ to: "/auth", search: { mode: "signin" } });
    return { user: data.user };
  },
  component: AppLayout,
});

function AppLayout() {
  // Cria perfil e configurações do usuário no primeiro acesso.
  useProvisionAccount();

  return (
    <div className="flex h-screen w-full overflow-hidden bg-background">
      <AppSidebar />
      <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
        <MobileNav />
        <main className="min-h-0 flex-1 overflow-y-auto">
          <div className="mx-auto w-full max-w-6xl px-5 py-8 md:px-10 md:py-10">
            <Outlet />
          </div>
        </main>
      </div>
      <OnboardingDialog />
      <WhatsNewNotifier />
      <GlobalFeatureToast />
      <NewsUpdatesSheet />
    </div>
  );
}
