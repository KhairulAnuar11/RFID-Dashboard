import { Badge } from '@/components/ui/badge';

interface Props {
  device: any;
}

export const DeviceBadges: React.FC<Props> = ({ device }) => {
  const now = Date.now();
  
  // Calculate time-based conditions
  const lastHeartbeat = device.lastHeartbeat
    ? new Date(device.lastHeartbeat).getTime()
    : 0;

  const createdAt = device.createdAt
    ? new Date(device.createdAt).getTime()
    : 0;

  const isRecentlyActive = now - lastHeartbeat < 60_000; // < 1 minute
  const isNew = createdAt && now - createdAt < 5 * 60_000; // < 5 minutes
  const isAutoDiscovered = device.discoverySource === 'auto';

  return (
    <div className="flex flex-wrap gap-1">
      {/* Discovery Source Badge */}
      {isAutoDiscovered ? (
        <Badge variant="secondary" className="bg-purple-600">🟣 Auto-Discovered</Badge>
      ) : (
        <Badge variant="outline" className="bg-blue-600">🔵 Manual</Badge>
      )}

      {/* Status Badge */}
      {device.status === 'online' ? (
        <Badge className="bg-green-600">🟢 Online</Badge>
      ) : (
        <Badge variant="destructive" className="bg-red-600">🔴 Offline</Badge>
      )}

      {/* Active Badge */}
      {isRecentlyActive && (
        <Badge className="bg-indigo-600">⚡ Active</Badge>
      )}

      {/* New Badge */}
      {isNew && (
        <Badge className="bg-orange-500">🆕 New</Badge>
      )}
    </div>
  );
};
