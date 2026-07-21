import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { randomUUID } from 'crypto';

@Injectable()
export class SupabaseStorageService {
  private readonly logger = new Logger(SupabaseStorageService.name);
  private readonly client: SupabaseClient;
  private readonly bucket: string;

  constructor(private readonly config: ConfigService) {
    this.client = createClient(
      this.config.getOrThrow<string>('SUPABASE_URL'),
      this.config.getOrThrow<string>('SUPABASE_SERVICE_ROLE_KEY'),
      { auth: { persistSession: false, autoRefreshToken: false } },
    );
    this.bucket = this.config.get<string>('SUPABASE_STORAGE_BUCKET') ?? 'societyone-docs';
  }

  async upload(params: {
    societyId: string;
    folder: string;
    fileName: string;
    body: Buffer;
    contentType: string;
  }): Promise<{ path: string; url: string }> {
    const safeName = params.fileName.replace(/[^a-zA-Z0-9._-]/g, '_');
    const path = `${params.societyId}/${params.folder}/${randomUUID()}-${safeName}`;

    const { error } = await this.client.storage.from(this.bucket).upload(path, params.body, {
      contentType: params.contentType,
      upsert: false,
    });

    if (error) {
      this.logger.error(`Storage upload failed: ${error.message}`);
      throw error;
    }

    const { data } = this.client.storage.from(this.bucket).getPublicUrl(path);
    return { path, url: data.publicUrl };
  }

  async createSignedUrl(path: string, expiresInSeconds = 3600): Promise<string> {
    const { data, error } = await this.client.storage
      .from(this.bucket)
      .createSignedUrl(path, expiresInSeconds);
    if (error || !data?.signedUrl) {
      throw error ?? new Error('Failed to create signed URL');
    }
    return data.signedUrl;
  }
}
