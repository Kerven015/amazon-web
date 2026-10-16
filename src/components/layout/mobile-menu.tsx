import { ArrowRight, Heart, Package, Sparkles, User } from "lucide-react";
import { Link } from "@/lib/router";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/motion-ui/accordion";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import { mainNav } from "@/lib/navigation";
import { openPanel, usePanels } from "@/lib/store/ui";
import { useT } from "@/i18n";
import { LanguageSwitcher } from "./language-switcher";
import { NavIcon } from "@/components/ui/nav-icon";
import { useGoHome } from "./home-link";
import { useNavText } from "./mega-menu";

const row = "flex min-h-11 w-full items-center text-[15px] text-navy";

/** Full-height cream drawer (<1024px). Radix Dialog locks body scroll and traps focus. */
export function MobileMenu() {
  const open = usePanels((s) => s.open === "menu");
  const close = usePanels((s) => s.close);
  const t = useT("header");
  const text = useNavText();
  const home = useGoHome();

  return (
    <Sheet open={open} onOpenChange={(o) => !o && close()}>
      <SheetContent side="left" title={t("menu")} className="bg-cream text-navy" bodyClassName="px-5 pb-10">
        <nav aria-label={t("mainNav")}>
          <Link
            href="/"
            onClick={home.onClick}
            aria-current={home.onHome ? "page" : undefined}
            className="flex min-h-14 items-center border-b border-navy/10 text-[17px] font-semibold text-navy aria-[current=page]:underline aria-[current=page]:decoration-1 aria-[current=page]:underline-offset-[5px]"
          >
            <span aria-hidden="true" className="mr-2 inline-flex w-[22px] shrink-0 justify-center">
              <NavIcon name="home" size={18} />
            </span>
            {t("home")}
          </Link>
          <Accordion type="single" className="divide-y divide-navy/10 border-b border-navy/10">
            {mainNav.map((item) =>
              item.groups ? (
                <AccordionItem key={item.id} value={item.id} className="py-0">
                  <AccordionTrigger className="min-h-14 text-[17px] font-semibold text-navy">
                    {text.item(item)}
                    <span aria-hidden="true" className="text-xl font-light leading-none transition-transform duration-200 group-data-[state=open]:rotate-45">
                      +
                    </span>
                  </AccordionTrigger>
                  <AccordionContent className="space-y-6 pb-6">
                    {/* The item itself is a page too: "View all" first, then the groups */}
                    <Link
                      href={item.href}
                      onClick={close}
                      aria-label={t("viewAllNamed", { item: text.item(item) })}
                      className={`${row} group/link h-11 border-b border-navy/10 font-medium`}
                    >
                      <span aria-hidden="true" className="mr-2 inline-flex w-[22px] shrink-0 justify-center">
                        <ArrowRight className="size-4" strokeWidth={1.5} />
                      </span>
                      <span className="group-hover/link:underline group-hover/link:underline-offset-[3px]">{t("viewAll")}</span>
                    </Link>
                    {item.groups.map((group) => (
                      <section key={group.key}>
                        <h3 className="mb-1 text-[17px] font-semibold tracking-[-0.01em] text-navy">{text.group(group)}</h3>
                        <ul>
                          {group.links.map((link) => (
                            <li key={`${group.key}-${link.key}`}>
                              <Link href={link.href} onClick={close} className={`${row} group/link h-11 text-navy/90`}>
                                {/* Fixed 22px icon box + 8px gap keeps every label in the column aligned */}
                                <span aria-hidden="true" className="mr-2 inline-flex w-[22px] shrink-0 justify-center">
                                  {link.icon && <NavIcon name={link.icon} size={18} />}
                                </span>
                                <span className="group-hover/link:underline group-hover/link:underline-offset-[3px]">{text.link(link)}</span>
                              </Link>
                            </li>
                          ))}
                        </ul>
                      </section>
                    ))}
                  </AccordionContent>
                </AccordionItem>
              ) : (
                <div key={item.id}>
                  <Link href={item.href} onClick={close} className="flex min-h-14 items-center text-[17px] font-semibold text-navy">
                    {text.item(item)}
                  </Link>
                </div>
              ),
            )}
          </Accordion>
        </nav>

        <ul className="mt-6 text-[15px]">
          <li>
            <Link href="/login" onClick={close} className={`${row} gap-3`}>
              <User className="size-4" strokeWidth={1.5} aria-hidden="true" /> {t("loginOrRegister")}
            </Link>
          </li>
          <li>
            <Link href="/account?tab=orders" onClick={close} className={`${row} gap-3`}>
              <Package className="size-4" strokeWidth={1.5} aria-hidden="true" /> {t("yourOrders")}
            </Link>
          </li>
          <li>
            <button type="button" onClick={() => openPanel("wishlist")} className={`${row} gap-3`}>
              <Heart className="size-4" strokeWidth={1.5} aria-hidden="true" /> {t("wishlist")}
            </button>
          </li>
          <li>
            <button type="button" onClick={() => openPanel("quiz")} className={`${row} gap-3`}>
              <Sparkles className="size-4" strokeWidth={1.5} aria-hidden="true" /> {t("quiz")}
            </button>
          </li>
        </ul>

        <LanguageSwitcher variant="list" className="mt-8 border-t border-navy/10 pt-6" />
      </SheetContent>
    </Sheet>
  );
}
