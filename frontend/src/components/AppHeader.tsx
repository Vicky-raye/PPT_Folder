import { BookOpen } from "lucide-react";
import { Link, useLocation } from "react-router-dom";

interface BreadcrumbItem {
  label: string;
  href?: string;
}

export default function AppHeader() {
  const location = useLocation();

  const breadcrumbs: BreadcrumbItem[] = [{ label: "PPT Folder", href: "/" }];

  if (location.pathname.startsWith("/course/")) {
    breadcrumbs.push({ label: "课程详情" });
  }
  if (location.pathname.startsWith("/workspace/")) {
    breadcrumbs.push({ label: "学习工作区" });
  }

  return (
    <header className="sticky top-0 z-50 border-b bg-card/80 backdrop-blur-sm">
      <div className="flex h-14 items-center gap-3 px-6">
        <Link to="/" className="flex items-center gap-2.5 font-semibold text-foreground">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary">
            <BookOpen className="h-4 w-4 text-primary-foreground" />
          </div>
          <span className="text-lg tracking-tight">PPT Folder</span>
        </Link>

        {breadcrumbs.length > 1 && (
          <nav className="flex items-center gap-1.5 text-sm text-muted-foreground">
            {breadcrumbs.map((item, i) => (
              <span key={i} className="flex items-center gap-1.5">
                {i > 0 && <span className="text-border">/</span>}
                {item.href ? (
                  <Link to={item.href} className="hover:text-foreground transition-colors">
                    {item.label}
                  </Link>
                ) : (
                  <span className="text-foreground">{item.label}</span>
                )}
              </span>
            ))}
          </nav>
        )}
      </div>
    </header>
  );
}
