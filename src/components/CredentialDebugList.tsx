import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';

export function CredentialDebugList({ user }: { user: any }) {
    const [creds, setCreds] = useState<any[]>([]);

    useEffect(() => {
        if (!user) return;
        supabase.from('platform_credentials')
            .select('*')
            .eq('user_id', user.id)
            .eq('is_active', true) // Only show active credentials
            .then(({ data }) => setCreds(data || []));
    }, [user]);

    if (!creds.length) return <div className="text-[10px] text-muted-foreground">No active credentials found.</div>;

    return (
        <table className="w-full text-[10px] font-mono border mt-1">
            <thead className="bg-muted">
                <tr>
                    <th className="p-1 border">ID</th>
                    <th className="p-1 border">Platform</th>
                    <th className="p-1 border">Platform Acc ID</th>
                    <th className="p-1 border">Name</th>
                    <th className="p-1 border">Active?</th>
                </tr>
            </thead>
            <tbody>
                {creds.map(c => (
                    <tr key={c.id} className="border-t">
                        <td className="p-1 border truncate max-w-[50px]">{c.id}</td>
                        <td className="p-1 border">{c.platform}</td>
                        <td className="p-1 border">{c.platform_account_id}</td>
                        <td className="p-1 border">{c.account_name || '-'}</td>
                        <td className="p-1 border">{c.is_active ? 'Yes' : 'No'}</td>
                    </tr>
                ))}
            </tbody>
        </table>
    );
}
