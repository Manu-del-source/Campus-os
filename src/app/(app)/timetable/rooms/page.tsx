import type { Metadata } from 'next';

import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/empty-state';
import { PageHeader } from '@/components/ui/page-header';
import { DataTable, Td, Th } from '@/components/ui/table';
import { requirePermission } from '@/lib/auth/session';
import { formatNumber } from '@/lib/utils';
import { listRooms } from '@/server/timetable/rooms';
import { CreateRoomForm } from './create-form';
import { roomListQuerySchema } from '@/server/timetable/schemas';

export const metadata: Metadata = { title: 'Rooms' };

interface PageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export default async function RoomsPage({ searchParams }: PageProps) {
  const context = await requirePermission('academics.read');
  const params = await searchParams;

  const parsed = roomListQuerySchema.safeParse({
    search: typeof params.search === 'string' ? params.search : undefined,
    page: typeof params.page === 'string' ? params.page : undefined,
  });

  const query = parsed.success ? parsed.data : roomListQuerySchema.parse({});
  const result = await listRooms(context, query);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Rooms"
        description={`${formatNumber(result.total)} room${result.total === 1 ? '' : 's'} available.`}
      />

      <Card>
        <form method="get" className="flex flex-col gap-3 border-b border-[var(--color-border)] p-4 sm:flex-row">
          <div className="flex-1 space-y-1.5">
            <label htmlFor="search" className="sr-only">Search rooms</label>
            <input
              id="search"
              name="search"
              type="search"
              defaultValue={query.search ?? ''}
              placeholder="Search by code, name, or building"
              className="h-10 w-full rounded-[var(--radius-base)] border border-[var(--color-border)] bg-[var(--color-surface)] px-3 text-sm"
            />
          </div>
          <button
            type="submit"
            className="h-10 rounded-[var(--radius-base)] bg-[var(--color-accent)] px-4 text-sm font-medium text-[var(--color-accent-foreground)]"
          >
            Search
          </button>
        </form>

        <div className="p-4">
          <CreateRoomForm />
        </div>

        {result.rows.length === 0 ? (
          <div className="p-4">
            <EmptyState
              title="No rooms"
              description="Add rooms to start scheduling classes."
            />
          </div>
        ) : (
          <DataTable caption="Rooms">
            <thead>
              <tr>
                <Th>Code</Th>
                <Th>Name</Th>
                <Th className="hidden md:table-cell">Building</Th>
                <Th className="hidden md:table-cell">Floor</Th>
                <Th className="hidden lg:table-cell">Capacity</Th>
                <Th>Status</Th>
              </tr>
            </thead>
            <tbody>
              {result.rows.map((room) => (
                <tr key={room.id}>
                  <Td className="font-medium">{room.code}</Td>
                  <Td>{room.name}</Td>
                  <Td className="hidden md:table-cell text-sm">{room.building ?? '—'}</Td>
                  <Td className="hidden md:table-cell text-sm">{room.floor ?? '—'}</Td>
                  <Td className="hidden lg:table-cell text-sm">{room.capacity ?? '—'}</Td>
                  <Td>
                    <Badge tone={room.isActive ? 'success' : 'neutral'}>
                      {room.isActive ? 'active' : 'inactive'}
                    </Badge>
                  </Td>
                </tr>
              ))}
            </tbody>
          </DataTable>
        )}
      </Card>
    </div>
  );
}
