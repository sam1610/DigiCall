import { useState } from 'react';
import { Call } from '@/lib/mock-data';
import { useAppStore } from '@/stores/app-store';
import { useAuthStore } from '@/stores/auth-store';
import { SentimentBadge } from './SentimentBadge';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import {
  Clock,
  User,
  CheckCircle,
  XCircle,
  Star,
  AlertTriangle,
  MessageSquare,
  Send,
  MapPin,
  Stethoscope
} from 'lucide-react';
import { toast } from '@/hooks/use-toast';

interface CallDetailDrawerProps {
  call: Call | any; // allow backend schema
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function CallDetailDrawer({ call, open, onOpenChange }: CallDetailDrawerProps) {
  const [newNote, setNewNote] = useState('');
  const { user } = useAuthStore();
  const { exemplarCallIds, toggleExemplar, callNotes, addNote, alerts, setAlerts } = useAppStore();

  if (!call) return null;

  const isExemplar = exemplarCallIds.includes(call.id);
  const notes = callNotes.filter((n) => n.callId === call.id);

  const formatDuration = (seconds: number) => {
    if (!seconds) return '0:00';
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const handleToggleExemplar = () => {
    toggleExemplar(call.id);
    toast({
      title: isExemplar ? 'Removed from Exemplars' : 'Added to Exemplars',
      description: isExemplar
        ? 'This call is no longer marked as an exemplar.'
        : 'This call has been added to the exemplar library.',
    });
  };

  const handleCreateAlert = () => {
    const newAlert = {
      id: `alert-${Date.now()}`,
      callId: call.id,
      createdAt: new Date().toISOString(),
      ruleId: 'manual',
      ruleLabel: 'Manual Review',
      severity: 'medium' as const,
      status: 'open' as const,
      issue: `Manual alert for medical request`,
    };
    setAlerts([newAlert, ...alerts]);
    toast({
      title: 'Alert Created',
      description: 'A new alert has been created for this call.',
    });
  };

  const handleAddNote = () => {
    if (!newNote.trim() || !user) return;
    addNote({
      callId: call.id,
      userId: user.id,
      userName: user.name,
      text: newNote.trim(),
    });
    setNewNote('');
    toast({
      title: 'Note Added',
      description: 'Your note has been saved.',
    });
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-2xl overflow-hidden flex flex-col">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            Patient Triage Details
            {call.sentimentLabel && <SentimentBadge sentiment={call.sentimentLabel} />}
          </SheetTitle>
        </SheetHeader>

        <ScrollArea className="flex-1 -mx-6 px-6">
          <div className="space-y-6 pb-6">
            {/* Call Info */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <p className="text-sm text-muted-foreground">Phone Number</p>
                <p className="font-medium flex items-center gap-2">
                  {call.pk ? call.pk.replace('PATIENT#', '') : call.phoneNumber || 'Unknown'}
                </p>
              </div>
              <div className="space-y-1">
                <p className="text-sm text-muted-foreground">Date</p>
                <p className="font-medium">
                  {new Date(call.createdAt || call.startedAt).toLocaleString()}
                </p>
              </div>
              <div className="space-y-1">
                <p className="text-sm text-muted-foreground">Status</p>
                <p className="font-medium flex items-center gap-2">
                  <CheckCircle className="h-4 w-4 text-success" />
                  {call.status || 'Verified'}
                </p>
              </div>
            </div>

            {/* REAL AI TRIAGE SUMMARY */}
            <div className="p-4 bg-muted/50 rounded-lg border border-primary/20">
              <h4 className="font-semibold mb-3 flex items-center gap-2">
                <Stethoscope className="h-4 w-4 text-primary" />
                Triage Nurse Summary
              </h4>
              
              <div className="space-y-3">
                <div>
                  <p className="text-xs text-muted-foreground mb-1 uppercase tracking-wider font-semibold">Patient Symptoms</p>
                  <p className="text-sm leading-relaxed">{call.symptoms || 'No symptoms recorded.'}</p>
                </div>
                
                {call.address && (
                  <div>
                    <p className="text-xs text-muted-foreground mb-1 uppercase tracking-wider font-semibold">Address on File</p>
                    <p className="text-sm flex items-center gap-2">
                      <MapPin className="h-3 w-3" />
                      {call.address}
                    </p>
                  </div>
                )}
              </div>
            </div>

            {/* Notes */}
            <div>
              <h4 className="font-semibold mb-3 flex items-center gap-2">
                <MessageSquare className="h-4 w-4" />
                Notes
              </h4>
              <div className="space-y-2 mb-3">
                {notes.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No notes yet.</p>
                ) : (
                  notes.map((note) => (
                    <div key={note.id} className="p-3 bg-muted/50 rounded-lg">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-xs font-medium">{note.userName}</span>
                        <span className="text-xs text-muted-foreground">
                          {new Date(note.createdAt).toLocaleString()}
                        </span>
                      </div>
                      <p className="text-sm">{note.text}</p>
                    </div>
                  ))
                )}
              </div>
              <div className="flex gap-2">
                <Input
                  placeholder="Add a note..."
                  value={newNote}
                  onChange={(e) => setNewNote(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleAddNote()}
                />
                <Button size="icon" onClick={handleAddNote} disabled={!newNote.trim()}>
                  <Send className="h-4 w-4" />
                </Button>
              </div>
            </div>

            {/* Actions */}
            <div className="flex flex-wrap gap-2 pt-4 border-t">
              <Button
                variant={isExemplar ? 'secondary' : 'outline'}
                size="sm"
                onClick={handleToggleExemplar}
              >
                <Star className={`h-4 w-4 mr-2 ${isExemplar ? 'fill-current' : ''}`} />
                {isExemplar ? 'Remove Exemplar' : 'Mark as Exemplar'}
              </Button>
              <Button variant="outline" size="sm" onClick={handleCreateAlert}>
                <AlertTriangle className="h-4 w-4 mr-2" />
                Create Alert
              </Button>
            </div>
          </div>
        </ScrollArea>
      </SheetContent>
    </Sheet>
  );
}