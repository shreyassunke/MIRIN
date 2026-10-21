import {
  lazy,
  memo,
  Suspense,
  useContext,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import {
  Navigate,
  Outlet,
  Route,
  Routes,
  UNSAFE_LocationContext,
  UNSAFE_RouteContext,
  useLocation,
} from "react-router-dom";
import { RequireAuth } from "./auth/RequireAuth";
import { AppShell } from "./components/AppShell";
import { BootSplash } from "./components/BootSplash";
import { Auth } from "./screens/Auth";
import { Privacy } from "./screens/Privacy";
import { History } from "./screens/History";
import { Log } from "./screens/Log";
import { Profile, ProfileAccount } from "./screens/Profile";
import { SplitEditor } from "./screens/SplitEditor";
import { Today } from "./screens/Today";

const loadExerciseDetail = () =>
  import("./screens/ExerciseDetail").then((m) => ({
    default: m.ExerciseDetail,
  }));
const loadProfileDetails = () =>
  import("./screens/ProfileDetails").then((m) => ({
    default: m.ProfileDetails,
  }));
const loadSessionDetail = () =>
  import("./screens/SessionDetail").then((m) => ({
    default: m.SessionDetail,
  }));

const ExerciseDetail = lazy(loadExerciseDetail);
const ProfileDetails = lazy(loadProfileDetails);
const SessionDetail = lazy(loadSessionDetail);

const TodayPane = memo(Today);
const HistoryPane = memo(History);
const LogPane = memo(Log);
const SplitPane = memo(SplitEditor);
const ProfilePane = memo(Profile);

function TabKeepAlive({
  active,
  defaultPath,
  paneRef,
  children,
}: {
  active: boolean;
  defaultPath: string;
  paneRef: (node: HTMLDivElement | null) => void;
  children: ReactNode;
}) {
  const locationCtx = useContext(UNSAFE_LocationContext);
  const routeCtx = useContext(UNSAFE_RouteContext);
  const frozenLocationRef = useRef<typeof locationCtx | null>(null);
  const frozenRouteRef = useRef(routeCtx);

  if (!frozenLocationRef.current) {
    frozenLocationRef.current = active
      ? locationCtx
      : {
          ...locationCtx,
          location: {
            ...locationCtx.location,
            pathname: defaultPath,
            search: "",
            hash: "",
          },
        };
  } else if (active) {
    const prev = frozenLocationRef.current.location;
    const next = locationCtx.location;
    if (
      prev.pathname !== next.pathname ||
      prev.search !== next.search ||
      prev.hash !== next.hash ||
      prev.state !== next.state
    ) {
      frozenLocationRef.current = locationCtx;
      frozenRouteRef.current = routeCtx;
    }
  }

  return (
    <div
      ref={paneRef}
      hidden={!active}
      aria-hidden={!active ? "true" : undefined}
    >
      <UNSAFE_LocationContext.Provider
        value={frozenLocationRef.current ?? locationCtx}
      >
        <UNSAFE_RouteContext.Provider value={frozenRouteRef.current}>
          {children}
        </UNSAFE_RouteContext.Provider>
      </UNSAFE_LocationContext.Provider>
    </div>
  );
}

type TabId = "today" | "history" | "log" | "split" | "profile";

const TAB_ORDER: readonly TabId[] = [
  "today",
  "history",
  "log",
  "split",
  "profile",
];

const EASE_OUT_EXPO = "cubic-bezier(0.16, 1, 0.3, 1)";

function activeTabForPath(pathname: string): TabId | null {
  if (pathname === "/today") return "today";
  if (pathname === "/history") return "history";
  if (pathname === "/log" || pathname === "/log/body") return "log";
  if (pathname === "/split") return "split";
  if (pathname === "/profile") return "profile";
  return null;
}

function ownerTabForPath(pathname: string): TabId {
  const direct = activeTabForPath(pathname);
  if (direct) return direct;
  if (pathname.startsWith("/history/")) return "history";
  if (pathname.startsWith("/profile/")) return "profile";
  if (pathname.startsWith("/log/")) return "log";
  return "today";
}

function prefersReducedMotion() {
  return (
    typeof window !== "undefined" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches
  );
}

function animatePane(target: HTMLElement | null, dx: number) {
  if (!target || typeof target.animate !== "function") return;
  target.getAnimations().forEach((a) => a.cancel());
  if (prefersReducedMotion()) {
    target.animate([{ opacity: 0.72 }, { opacity: 1 }], {
      duration: 110,
      easing: EASE_OUT_EXPO,
    });
    return;
  }
  target.animate(
    [
      { opacity: 0, transform: `translate3d(${dx}px, 0, 0)` },
      { opacity: 1, transform: "translate3d(0, 0, 0)" },
    ],
    { duration: 165, easing: EASE_OUT_EXPO },
  );
}

function ProtectedLayout() {
  const { pathname } = useLocation();
  const activeTab = activeTabForPath(pathname);
  const [warmTabs, setWarmTabs] = useState<Record<TabId, boolean>>(() => {
    const initial = ownerTabForPath(pathname);
    return {
      today: true,
      history: initial === "history",
      log: initial === "log",
      split: initial === "split",
      profile: initial === "profile",
    };
  });

  const paneRefs = useRef<Record<TabId, HTMLDivElement | null>>({
    today: null,
    history: null,
    log: null,
    split: null,
    profile: null,
  });
  const detailRef = useRef<HTMLDivElement>(null);
  const prevPathRef = useRef(pathname);
  const activeTabRef = useRef<TabId | null>(activeTab);
  const scrollByTabRef = useRef<Record<TabId, number>>({
    today: 0,
    history: 0,
    log: 0,
    split: 0,
    profile: 0,
  });

  activeTabRef.current = activeTab;

  useEffect(() => {
    const target = ownerTabForPath(pathname);
    setWarmTabs((prev) => (prev[target] ? prev : { ...prev, [target]: true }));
  }, [pathname]);

  useEffect(() => {
    const t = window.setTimeout(() => {
      setWarmTabs({
        today: true,
        history: true,
        log: true,
        split: true,
        profile: true,
      });
      void loadExerciseDetail();
      void loadSessionDetail();
      void loadProfileDetails();
    }, 120);
    return () => window.clearTimeout(t);
  }, []);

  useEffect(() => {
    const onScroll = () => {
      const current = activeTabRef.current;
      if (current) {
        scrollByTabRef.current[current] = window.scrollY;
      }
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useLayoutEffect(() => {
    const prevPath = prevPathRef.current;
    if (prevPath === pathname) return;
    prevPathRef.current = pathname;

    const prevTab = activeTabForPath(prevPath);
    const nextTab = activeTabForPath(pathname);

    // Sub-tab switches inside /log are animated by Log itself.
    if (prevTab === "log" && nextTab === "log") return;

    const prevOwner = ownerTabForPath(prevPath);
    const nextOwner = ownerTabForPath(pathname);
    let dx = 10;
    if (prevTab !== null && nextTab !== null) {
      dx = TAB_ORDER.indexOf(nextTab) >= TAB_ORDER.indexOf(prevTab) ? 10 : -10;
    } else if (prevTab !== null && nextTab === null) {
      dx = 14;
    } else if (prevTab === null && nextTab !== null) {
      dx =
        prevOwner === nextOwner
          ? -10
          : TAB_ORDER.indexOf(nextTab) >= TAB_ORDER.indexOf(prevOwner)
            ? 10
            : -10;
    } else {
      dx = pathname.length >= prevPath.length ? 14 : -10;
    }

    const nextScroll = nextTab ? scrollByTabRef.current[nextTab] : 0;
    if (window.scrollY !== nextScroll) {
      window.scrollTo(0, nextScroll);
    }

    const target = nextTab ? paneRefs.current[nextTab] : detailRef.current;
    animatePane(target, dx);
  }, [pathname]);

  return (
    <RequireAuth>
      <BootSplash>
        <AppShell>
          <TabKeepAlive
            active={activeTab === "today"}
            defaultPath="/today"
            paneRef={(node) => {
              paneRefs.current.today = node;
            }}
          >
            <TodayPane />
          </TabKeepAlive>
          {warmTabs.history || activeTab === "history" ? (
            <TabKeepAlive
              active={activeTab === "history"}
              defaultPath="/history"
              paneRef={(node) => {
                paneRefs.current.history = node;
              }}
            >
              <HistoryPane />
            </TabKeepAlive>
          ) : null}
          {warmTabs.log || activeTab === "log" ? (
            <TabKeepAlive
              active={activeTab === "log"}
              defaultPath="/log"
              paneRef={(node) => {
                paneRefs.current.log = node;
              }}
            >
              <LogPane mode={pathname === "/log/body" ? "body" : "daily"} />
            </TabKeepAlive>
          ) : null}
          {warmTabs.split || activeTab === "split" ? (
            <TabKeepAlive
              active={activeTab === "split"}
              defaultPath="/split"
              paneRef={(node) => {
                paneRefs.current.split = node;
              }}
            >
              <SplitPane />
            </TabKeepAlive>
          ) : null}
          {warmTabs.profile || activeTab === "profile" ? (
            <TabKeepAlive
              active={activeTab === "profile"}
              defaultPath="/profile"
              paneRef={(node) => {
                paneRefs.current.profile = node;
              }}
            >
              <ProfilePane />
            </TabKeepAlive>
          ) : null}
          {activeTab === null ? (
            <div ref={detailRef}>
              <Suspense fallback={null}>
                <Outlet />
              </Suspense>
            </div>
          ) : null}
        </AppShell>
      </BootSplash>
    </RequireAuth>
  );
}

export default function App() {
  return (
    <Routes>
      <Route path="/privacy" element={<Privacy />} />
      <Route path="/auth" element={<Auth />} />
      <Route element={<ProtectedLayout />}>
        <Route path="/" element={<Navigate to="/today" replace />} />
        <Route path="/today" element={null} />
        <Route path="/exercise/:id" element={<ExerciseDetail />} />
        <Route path="/progress" element={<Navigate to="/profile" replace />} />
        <Route
          path="/history/progress"
          element={<Navigate to="/profile" replace />}
        />
        <Route path="/history" element={null} />
        <Route path="/history/session/:sessionId" element={<SessionDetail />} />
        <Route path="/nutrition" element={<Navigate to="/log" replace />} />
        <Route path="/macros" element={<Navigate to="/log" replace />} />
        <Route path="/log" element={null}>
          <Route index element={null} />
          <Route path="body" element={null} />
        </Route>
        <Route path="/split" element={null} />
        <Route path="/profile" element={null}>
          <Route index element={null} />
        </Route>
        <Route path="/profile/account" element={<ProfileAccount />} />
        <Route
          path="/profile/progress"
          element={<Navigate to="/profile" replace />}
        />
        <Route path="/profile/details" element={<ProfileDetails />} />
        <Route
          path="/profile/appearance"
          element={<Navigate to="/profile/account" replace />}
        />
        <Route
          path="/profile/measurements"
          element={<Navigate to="/log/body" replace />}
        />
      </Route>
      <Route path="*" element={<Navigate to="/today" replace />} />
    </Routes>
  );
}
