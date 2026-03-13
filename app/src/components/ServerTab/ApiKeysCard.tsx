import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Eye, EyeOff, Key, Save } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { useToast } from '@/components/ui/use-toast';
import { apiClient } from '@/lib/api/client';

interface KeyField {
  settingKey: string;
  label: string;
  placeholder: string;
}

const KEY_FIELDS: KeyField[] = [
  {
    settingKey: 'elevenlabs_api_key',
    label: 'ElevenLabs API Key',
    placeholder: 'sk_...',
  },
  {
    settingKey: 'voicebox_api_key',
    label: 'Voicebox API Key',
    placeholder: 'Enter API key for remote access',
  },
];

export function ApiKeysCard() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const { data: settings } = useQuery({
    queryKey: ['settings'],
    queryFn: () => apiClient.listSettings(),
  });

  // Local state for editing values
  const [editValues, setEditValues] = useState<Record<string, string>>({});
  const [visibleKeys, setVisibleKeys] = useState<Set<string>>(new Set());

  const updateMutation = useMutation({
    mutationFn: ({ key, value }: { key: string; value: string }) =>
      apiClient.updateSetting(key, value),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['settings'] });
      // Clear local edit state
      setEditValues((prev) => {
        const next = { ...prev };
        delete next[variables.key];
        return next;
      });
      toast({ title: 'API key saved', description: `${variables.key} updated successfully` });
    },
    onError: (err: Error) => {
      toast({ title: 'Save failed', description: err.message, variant: 'destructive' });
    },
  });

  const getDisplayValue = (settingKey: string): string => {
    if (editValues[settingKey] !== undefined) return editValues[settingKey];
    const setting = settings?.find((s) => s.key === settingKey);
    return setting?.value ?? '';
  };

  const isEditing = (settingKey: string) => editValues[settingKey] !== undefined;

  const hasValue = (settingKey: string) => {
    const setting = settings?.find((s) => s.key === settingKey);
    return setting?.value ? setting.value.length > 0 && setting.value !== '****' : false;
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <Key className="h-4 w-4" />
          API Keys
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {KEY_FIELDS.map((field) => {
          const isVisible = visibleKeys.has(field.settingKey);
          const editing = isEditing(field.settingKey);
          const displayValue = getDisplayValue(field.settingKey);

          return (
            <div key={field.settingKey} className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label className="text-sm font-medium">{field.label}</label>
                {hasValue(field.settingKey) && !editing && (
                  <span className="text-xs text-green-500">Set</span>
                )}
              </div>
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <Input
                    type={isVisible ? 'text' : 'password'}
                    placeholder={field.placeholder}
                    value={displayValue}
                    onChange={(e) =>
                      setEditValues((prev) => ({ ...prev, [field.settingKey]: e.target.value }))
                    }
                    className="pr-10"
                  />
                  <button
                    type="button"
                    onClick={() =>
                      setVisibleKeys((prev) => {
                        const next = new Set(prev);
                        if (next.has(field.settingKey)) next.delete(field.settingKey);
                        else next.add(field.settingKey);
                        return next;
                      })
                    }
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  >
                    {isVisible ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
                {editing && (
                  <Button
                    size="sm"
                    onClick={() =>
                      updateMutation.mutate({
                        key: field.settingKey,
                        value: editValues[field.settingKey],
                      })
                    }
                    disabled={updateMutation.isPending}
                  >
                    <Save className="h-3.5 w-3.5 mr-1" />
                    Save
                  </Button>
                )}
              </div>
            </div>
          );
        })}
        <p className="text-xs text-muted-foreground">
          API keys are encrypted at rest and never exposed in full.
        </p>
      </CardContent>
    </Card>
  );
}
