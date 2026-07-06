'use client';
import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { supabase } from '@/lib/supabase/client';
import { RefreshCw, BarChart3 } from 'lucide-react';

type Stats = Record<string, number>;
const tables = [
  ['products','Produkty'],['orders_3d','Zamówienia 3D'],['store_orders','Zamówienia sklepu'],['filaments','Filamenty'],['materials','Materiały'],['contact_submissions','Wiadomości'],['blog_posts','Blog'],['faq_items','FAQ']
];
export default function Page(){
 const [stats,setStats]=useState<Stats>({}); const [loading,setLoading]=useState(false);
 const load=async()=>{setLoading(true); const next:Stats={}; for(const [table,label] of tables){const {count}=await (supabase as any).from(table).select('*',{count:'exact',head:true}); next[label]=count||0;} setStats(next); setLoading(false)};
 useEffect(()=>{load()},[]);
 return <div className="space-y-6"><div className="flex items-center justify-between"><div><h1 className="text-3xl font-bold">Analityka</h1><p className="text-muted-foreground mt-1">Szybki przegląd danych w systemie.</p></div><Button variant="outline" onClick={load}><RefreshCw className="w-4 h-4 mr-2"/>Odśwież</Button></div><div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">{tables.map(([,label])=><Card key={label} className="bg-card border-border"><CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground flex items-center gap-2"><BarChart3 className="w-4 h-4"/>{label}</CardTitle></CardHeader><CardContent><p className="text-3xl font-bold">{loading?'...':stats[label]??0}</p></CardContent></Card>)}</div></div>
}
