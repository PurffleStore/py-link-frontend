import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { firstValueFrom } from 'rxjs';

import {
  JobStatusResponse,
  StartWorkflowResponse,
  WorkflowConfig
} from '../models/workflow.models';

import { environment } from '../../environments/environment';

@Injectable({ providedIn: 'root' })
export class WorkflowApiService {

  private readonly apiBaseUrl = environment.apiBaseUrl;

  constructor(private readonly http: HttpClient) {}

  startWorkflow(config: WorkflowConfig): Promise<StartWorkflowResponse> {
    return firstValueFrom(
      this.http.post<StartWorkflowResponse>(
        `${this.apiBaseUrl}/run-workflow`,
        config
      )
    );
  }

  getJobStatus(jobId: string): Promise<JobStatusResponse> {
    return firstValueFrom(
      this.http.get<JobStatusResponse>(
        `${this.apiBaseUrl}/job-status/${jobId}`
      )
    );
  }

  cancelWorkflow(jobId: string): Promise<{ ok: boolean }> {
    return firstValueFrom(
      this.http.post<{ ok: boolean }>(
        `${this.apiBaseUrl}/cancel-workflow`,
        { jobId }
      )
    );
  }
}