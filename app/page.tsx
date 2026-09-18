'use client';
import dynamic from 'next/dynamic';
const Exhibition=dynamic(()=>import('@/components/pavilion/Exhibition'),{ssr:false,loading:()=> <div className="loading">正在准备建筑展览…</div>});
export default function Page(){return <Exhibition/>}
