CREATE POLICY "Users read own letter files"
ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'letter-attachments' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users upload own letter files"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'letter-attachments' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users update own letter files"
ON storage.objects FOR UPDATE TO authenticated
USING (bucket_id = 'letter-attachments' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users delete own letter files"
ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'letter-attachments' AND auth.uid()::text = (storage.foldername(name))[1]);
