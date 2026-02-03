
"use client";

import { useState, useEffect, useRef } from "react";
import { useSearchParams } from "next/navigation";
import { useVirtualizer } from "@tanstack/react-virtual";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { 
  Dialog, 
  DialogContent, 
  DialogTitle, 
  DialogDescription,
} from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { Database, Search, RefreshCcw, Settings2, CheckCircle2, SearchCode } from "lucide-react";

interface PerformanceWithMemory extends Performance {
  memory?: {
    usedJSHeapSize: number;
    totalJSHeapSize: number;
    jsHeapSizeLimit: number;
  };
}

interface UserRow {
  id: string;
  name: string;
  email: string;
  role?: string;
}

interface DetailData extends UserRow {
  bio?: string;
  salary?: number;
}

export default function Home() {
  const [data, setData] = useState<UserRow[]>([]);
  const [status, setStatus] = useState("System Optimized");
  const [isLoading, setIsLoading] = useState(false);
  const [search, setSearch] = useState("");
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [isFetchingNextPage, setIsFetchingNextPage] = useState(false);
  const [dbLatency, setDbLatency] = useState<number | null>(null);
  const [editingRow, setEditingRow] = useState<UserRow | null>(null);
  const [detailData, setDetailData] = useState<DetailData | null>(null);
  const [isLoadingDetail, setIsLoadingDetail] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [memUsage, setMemUsage] = useState<number | undefined>(undefined);

  const parentRef = useRef<HTMLDivElement>(null);
  const searchParams = useSearchParams();

  // TIP #15: URL-State Synchronization - Initialize from URL
  useEffect(() => {
    const urlSearch = searchParams.get('q');
    if (urlSearch && urlSearch !== search) {
      setSearch(urlSearch);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);

  useEffect(() => {
    setMounted(true);
    const interval = setInterval(() => {
      const usage = (performance as PerformanceWithMemory).memory?.usedJSHeapSize;
      setMemUsage(usage);
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  // TIP #31: Search Debouncing (Robustness)
  useEffect(() => {
    if (!mounted) return;
    const timer = setTimeout(() => {
      handleFetch(search, false);
      // TIP #15: URL-State Synchronization - Update URL on search
      const newUrl = search ? `?q=${encodeURIComponent(search)}` : window.location.pathname;
      window.history.replaceState(null, '', newUrl);
    }, 300);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search, mounted]);

  const handleFetch = async (query = "", isNextPage = false) => {
    if (isNextPage && (!nextCursor || isFetchingNextPage)) return;
    
    if (isNextPage) {
      setIsFetchingNextPage(true);
    } else {
      setIsLoading(true);
      setNextCursor(null);
    }
    
    setStatus(isNextPage ? "Fetching next page..." : "Querying Turso Edge DB...");
    
    try {
      // TIP #4: Cursor Pagination Logic
      const cursorParam = isNextPage ? `&cursor=${nextCursor}` : '';
      const res = await fetch(`/api/data?search=${query}&limit=50${cursorParam}`);
      if (!res.ok) throw new Error("Database Query Failed");
      
      const { data: rows, latency, nextCursor: newCursor } = await res.json();
      
      if (isNextPage) {
        setData(prev => [...prev, ...rows]);
      } else {
        setData(rows);
      }
      
      setNextCursor(newCursor);
      setDbLatency(latency);
      setStatus(`DB Query: ${latency}ms | Total Records Loaded: ${(isNextPage ? data.length + rows.length : rows.length).toLocaleString()}`);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      setStatus("Error: " + message);
    } finally {
      setIsLoading(false);
      setIsFetchingNextPage(false);
    }
  };

  const rowVirtualizer = useVirtualizer({
    count: data.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 80,
    overscan: 10,
  });

  const virtualItems = rowVirtualizer.getVirtualItems();
  const lastItemIndex = virtualItems.length > 0 ? virtualItems[virtualItems.length - 1].index : -1;

  // REMOVED: Auto-Infinite Scroll Trigger that caused request flooding
  // We are now switching to Manual Load + Hover Prefetching (Tip #6 & #9)
  
  if (!mounted) return null;

  return (
    <div className="min-h-screen bg-[#fafafa] dark:bg-[#050505] text-[#171717] dark:text-[#ededed] font-sans selection:bg-emerald-500/30">
      
      <div className="fixed inset-0 overflow-hidden pointer-events-none opacity-20 dark:opacity-40 text-emerald-500">
        <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-emerald-500 rounded-full blur-[120px]" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-indigo-600 rounded-full blur-[120px]" />
      </div>

      <div className="relative max-w-[1400px] mx-auto px-6 py-12 md:py-20 space-y-12">
        
        <header className="space-y-6">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 dark:text-emerald-400 text-[10px] font-bold uppercase tracking-widest animate-in fade-in slide-in-from-top-4">
            <CheckCircle2 className="w-3 h-3" />
            Phase 2: Optimized Engine v1.0
          </div>
          <div className="flex flex-col md:flex-row md:items-end justify-between gap-8">
            <div className="space-y-2">
              <h1 className="text-5xl md:text-7xl font-bold tracking-tight leading-none bg-gradient-to-r from-[#171717] to-[#737373] dark:from-[#ededed] dark:to-[#737373] bg-clip-text text-transparent">
                SQL Indexing<br />& Virtualization.
              </h1>
              <p className="text-lg text-neutral-500 max-w-xl font-medium">
                Combining <strong>Tip #1 (Indexing)</strong> and <strong>Tip #2 (Virtualization)</strong>. 
                Instead of 300MB, we fetch bytes. Instead of 1M DOM rows, we render 10.
              </p>
            </div>
            
            <Card className="bg-white/40 dark:bg-neutral-900/40 backdrop-blur-xl border-neutral-200 dark:border-neutral-800 shadow-2xl">
              <CardContent className="p-6 min-w-[320px] space-y-6">
                <div className="flex items-center justify-between">
                  <div className="space-y-1">
                    <span className="text-[10px] font-black uppercase tracking-[0.2em] text-neutral-400">Memory Load</span>
                    <div className="flex items-center gap-2">
                       <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                       <span className="text-2xl font-mono font-black text-emerald-500">{memUsage ? Math.round(memUsage / 1048576) : '--'} MB</span>
                    </div>
                  </div>
                  <div className="text-right space-y-1">
                    <span className="text-[10px] font-black uppercase tracking-[0.2em] text-neutral-400">DB Latency</span>
                    <div className="text-2xl font-mono font-black text-indigo-500">{dbLatency ?? '--'}ms</div>
                  </div>
                </div>
                
                <div className="space-y-2">
                  <div className="h-1.5 bg-neutral-100 dark:bg-neutral-800 rounded-full overflow-hidden">
                    <div className="h-full bg-emerald-500 w-[15%] transition-all duration-1000" />
                  </div>
                  <div className="flex justify-between text-[10px] font-bold text-neutral-400 uppercase tracking-tighter">
                    <span>DOM: {rowVirtualizer.getVirtualItems().length} ROWS</span>
                    <span>Query Result: {data.length.toLocaleString()}</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </header>

        <div className="space-y-6">
          <div className="flex flex-col lg:flex-row gap-4">
            <Button 
              onClick={() => handleFetch(search)} 
              disabled={isLoading}
              className="h-16 px-10 rounded-2xl font-bold text-base transition-all bg-[#171717] text-white dark:bg-white dark:text-black hover:scale-[1.02] shadow-2xl flex items-center gap-3 active:scale-95"
            >
              {isLoading ? <RefreshCcw className="w-5 h-5 animate-spin" /> : <SearchCode className="w-5 h-5" />}
              <span>{isLoading ? "QUERYING..." : "INDEXED SEARCH"}</span>
            </Button>

            <div className="relative flex-1 group">
              <Search className="absolute left-6 top-1/2 -translate-y-1/2 w-5 h-5 text-neutral-400 group-focus-within:text-emerald-500 transition-colors" />
              <Input 
                value={search}
                placeholder="Type name to test Indexed O(log n) speed..."
                className="h-16 pl-14 pr-6 rounded-2xl border-neutral-200 dark:border-neutral-800 bg-white/40 dark:bg-neutral-900/40 backdrop-blur-md focus-visible:ring-emerald-500/50 text-base font-medium shadow-inner"
                onChange={(e) => setSearch(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleFetch(search)}
              />
            </div>

            <div className="flex items-center h-16 px-6 bg-emerald-500/5 border border-emerald-500/10 rounded-2xl gap-3 min-w-[300px]">
               <div className="flex flex-col leading-none">
                <span className="text-[10px] font-black uppercase tracking-[0.2em] text-neutral-400 mb-1.5">Runtime Status</span>
                <span className="text-xs font-bold font-mono text-emerald-600 dark:text-emerald-400 truncate max-w-[200px]">{status}</span>
              </div>
            </div>
          </div>

          <Card className="border-neutral-200 dark:border-neutral-800 bg-white/50 dark:bg-neutral-900/50 backdrop-blur-2xl shadow-3xl rounded-[2.5rem] overflow-hidden min-h-[600px] flex flex-col">
            <div className="bg-neutral-50/50 dark:bg-neutral-800/20 border-b border-neutral-200 dark:border-neutral-800 flex items-center px-10 py-6 text-[11px] font-bold uppercase tracking-[0.2em] text-neutral-500">
              <div className="w-32">Unique ID</div>
              <div className="flex-1 text-center">Identity Signature</div>
              <div className="w-48 text-right">Administrative</div>
            </div>
            
            <div 
              ref={parentRef}
              className="flex-1 h-[600px] overflow-auto scrollbar-thin scrollbar-thumb-neutral-200 dark:scrollbar-thumb-neutral-800"
            >
              {isLoading ? (
                <div className="p-10 space-y-4">
                  {[...Array(8)].map((_, i) => (
                    <div key={i} className="flex items-center gap-6 p-4 border-b border-neutral-100 dark:border-neutral-800/10">
                      <Skeleton className="h-4 w-24 rounded-full" />
                      <div className="flex-1 space-y-2">
                        <Skeleton className="h-5 w-48 rounded-md" />
                        <Skeleton className="h-3 w-64 rounded-md opacity-60" />
                      </div>
                      <Skeleton className="h-8 w-20 rounded-xl" />
                    </div>
                  ))}
                </div>
              ) : data.length > 0 ? (
                <>
                  <div
                    role="grid"
                    aria-label={`User list showing ${data.length.toLocaleString()} results`}
                    aria-rowcount={data.length}
                    style={{
                      height: `${rowVirtualizer.getTotalSize()}px`,
                      width: '100%',
                      position: 'relative',
                    }}
                  >
                    {rowVirtualizer.getVirtualItems().map((virtualRow) => {
                      const row = data[virtualRow.index];
                      return (
                        <div
                          key={virtualRow.key}
                          role="row"
                          aria-rowindex={virtualRow.index + 1}
                          aria-label={`User ${row.name}, email ${row.email}`}
                          tabIndex={0}
                          style={{
                            position: 'absolute',
                            top: 0,
                            left: 0,
                            width: '100%',
                            height: `${virtualRow.size}px`,
                            transform: `translateY(${virtualRow.start}px)`,
                          }}
                          className="flex items-center px-10 border-b border-neutral-100 dark:border-neutral-800/10 hover:bg-emerald-500/5 focus:bg-emerald-500/10 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 transition-colors duration-150"
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              e.currentTarget.querySelector('button')?.click();
                            }
                          }}
                        >
                          <div className="w-32 font-mono text-[10px] text-neutral-400">#{row.id?.substring(0,8) || virtualRow.index}</div>
                          <div className="flex-1 flex flex-col items-center">
                            <span className="text-lg font-bold text-[#171717] dark:text-[#ededed]">{row.name}</span>
                            <span className="text-xs text-neutral-400 font-medium">{row.email}</span>
                          </div>
                          <div className="w-48 text-right">
                            <Button 
                              variant="ghost" 
                              size="sm"
                              className="h-10 px-4 rounded-xl font-bold uppercase text-[10px] tracking-widest text-neutral-400 hover:text-emerald-500 hover:bg-emerald-500/5 transition-all"
                              onClick={async () => {
                                setEditingRow(row);
                                setIsLoadingDetail(true);
                                try {
                                  const res = await fetch(`/api/data/${row.id}`);
                                  if (res.ok) {
                                    const { data } = await res.json();
                                    setDetailData(data);
                                  }
                                } catch {
                                  console.error('Failed to load details');
                                } finally {
                                  setIsLoadingDetail(false);
                                }
                              }}
                            >
                              Details
                            </Button>
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  {/* TIP #6 & #9: Manual Load More + Hover Prefetching */}
                  {nextCursor && (
                    <div className="p-12 flex justify-center border-t border-neutral-100 dark:border-neutral-800/10 bg-neutral-50/30 dark:bg-neutral-900/30">
                      <Button
                        variant="outline"
                        size="lg"
                        className="h-14 px-8 rounded-2xl font-bold tracking-tight border-neutral-200 dark:border-neutral-800 hover:bg-white dark:hover:bg-neutral-800 hover:scale-[1.02] transition-all group"
                        disabled={isFetchingNextPage}
                        onMouseEnter={() => {
                          if (!isFetchingNextPage && !isLoading) {
                            handleFetch(search, true);
                          }
                        }}
                        onClick={() => {
                          if (!isFetchingNextPage && !isLoading) {
                            handleFetch(search, true);
                          }
                        }}
                      >
                        <div className="flex items-center gap-3">
                          {isFetchingNextPage ? (
                            <RefreshCcw className="w-4 h-4 animate-spin text-emerald-500" />
                          ) : (
                            <Settings2 className="w-4 h-4 text-neutral-400 group-hover:text-emerald-500 transition-colors" />
                          )}
                          <span>{isFetchingNextPage ? "Optimizing Stream..." : "Load More Discovery Data"}</span>
                        </div>
                      </Button>
                    </div>
                  )}
                </>
              ) : (
                <div className="h-full flex flex-col items-center justify-center opacity-40 text-center space-y-6">
                  <div className="p-8 rounded-[2.5rem] bg-neutral-100 dark:bg-neutral-800">
                     <Database className="w-16 h-16 text-neutral-400" />
                  </div>
                  <div className="space-y-1">
                    <p className="text-2xl font-black uppercase tracking-tighter">Database Ready.</p>
                    <p className="text-sm font-medium text-neutral-500">Run an Indexed Search to see the speed of 1,000,000 rows.</p>
                  </div>
                </div>
              )}
            </div>
          </Card>
        </div>
      </div>

      <Dialog open={!!editingRow} onOpenChange={() => { setEditingRow(null); setDetailData(null); }}>
        <DialogContent className="sm:max-w-xl rounded-[2.5rem] border-none bg-white/95 dark:bg-neutral-900/95 backdrop-blur-3xl p-0 overflow-hidden shadow-[0_32px_128px_-16px_rgba(0,0,0,0.5)]">
          <div className="p-10 space-y-8">
            <div className="flex items-center gap-4">
              <div className="w-14 h-14 rounded-2xl bg-emerald-500 flex items-center justify-center text-white">
                <Settings2 className="w-7 h-7" />
              </div>
              <div>
                <DialogTitle className="text-3xl font-black tracking-tight text-neutral-900 dark:text-neutral-50 uppercase">Entity Audit</DialogTitle>
                <DialogDescription className="text-neutral-500 font-medium italic">Viewing indexed record from Turso Edge.</DialogDescription>
              </div>
            </div>
            
            <div className="space-y-6">
              <div className="grid grid-cols-2 gap-4">
                 <div className="p-4 rounded-2xl bg-neutral-50 dark:bg-neutral-800/50 border border-neutral-100 dark:border-neutral-800">
                    <span className="text-[10px] font-black uppercase text-neutral-400 tracking-widest block mb-1">Full Name</span>
                    <span className="text-lg font-bold">{editingRow?.name}</span>
                 </div>
                 <div className="p-4 rounded-2xl bg-neutral-50 dark:bg-neutral-800/50 border border-neutral-100 dark:border-neutral-800">
                    <span className="text-[10px] font-black uppercase text-neutral-400 tracking-widest block mb-1">Commercial Value</span>
                    {isLoadingDetail ? (
                      <Skeleton className="h-7 w-24" />
                    ) : (
                      <span className="text-lg font-bold text-emerald-500 font-mono">${detailData?.salary?.toLocaleString() || '0'}</span>
                    )}
                 </div>
              </div>
              <div className="p-4 rounded-2xl bg-neutral-50 dark:bg-neutral-800/50 border border-neutral-100 dark:border-neutral-800">
                  <span className="text-[10px] font-black uppercase text-neutral-400 tracking-widest block mb-1">Bio / Profile String</span>
                  {isLoadingDetail ? (
                    <Skeleton className="h-16 w-full" />
                  ) : (
                    <span className="text-sm text-neutral-500 leading-relaxed font-medium">{detailData?.bio || 'No bio available'}</span>
                  )}
              </div>
            </div>

            <Button onClick={() => setEditingRow(null)} className="w-full h-16 rounded-2xl bg-[#171717] text-white dark:bg-white dark:text-black font-black uppercase tracking-widest hover:scale-[1.01] transition-all">
              Close Audit
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
