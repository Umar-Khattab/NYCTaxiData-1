import * as signalR from '@microsoft/signalr';

class SignalRService {
  private connection: signalR.HubConnection | null = null;
  private hubUrl = 'https://localhost:7112/hubs/tracking'; 

  public async startConnection(): Promise<void> {
    if (this.connection) return;

    this.connection = new signalR.HubConnectionBuilder()
      .withUrl(this.hubUrl)
      .withAutomaticReconnect()
      .build();

    try {
      await this.connection.start();
      console.log('SignalR Connected Successfully! 🎉');
    } catch (error) {
      console.error('SignalR Connection Error: ', error);
    }
  }

  public async updateDriverStatus(status: 'Available' | 'Busy' | string): Promise<void> {
    await this.ensureConnection();
    try {
      await this.connection!.invoke('UpdateDriverStatus', status);
    } catch (err) {
      console.error('Failed to update driver status:', err);
    }
  }

  public async sendMessageToDriver(driverId: string, message: string): Promise<void> {
    await this.ensureConnection();
    try {
      await this.connection!.invoke('SendMessageToDriver', driverId, message);
    } catch (err) {
      console.error('Failed to send message to driver:', err);
    }
  }

  public async updateLocation(lat: number, lng: number, speed: number, heading: number): Promise<void> {
    await this.ensureConnection();
    try {
      await this.connection!.invoke('UpdateLocation', lat, lng, speed, heading);
    } catch (err) {
      console.error('Failed to update location:', err);
    }
  }

  public async getAllDriverLocations(): Promise<void> {
    await this.ensureConnection();
    try {
      await this.connection!.invoke('GetAllDriverLocations');
    } catch (err) {
      console.error('Failed to get all driver locations:', err);
    }
  }

  public async sendDemandAlert(zoneName: string, time: string, statusDescription: string): Promise<void> {
    await this.ensureConnection();
    try {
      await this.connection!.invoke('SendDemandAlert', zoneName, time, statusDescription);
    } catch (err) {
      console.error('Failed to send demand alert:', err);
    }
  }

  public onLocationUpdated(callback: (driverId: string, lat: number, lng: number) => void): void {
    if (this.connection) {
      this.connection.on('DriverLocationChanged', (driverId, lat, lng) => {
        callback(driverId, lat, lng);
      });
    }
  }

  public onMessageReceived(callback: (message: string) => void): void {
    if (this.connection) {
      this.connection.on('ReceiveMessage', (message) => {
        callback(message);
      });
    }
  }

  public onDemandAlertReceived(callback: (zoneName: string, time: string, desc: string) => void): void {
    if (this.connection) {
      this.connection.on('DemandAlertNotification', (zoneName, time, desc) => {
        callback(zoneName, time, desc);
      });
    }
  }

  public onSimulationProgress(callback: (progress: number, message: string) => void): void {
    if (this.connection) {
      this.connection.on('SimulationProgress', (progress, message) => {
        callback(progress, message);
      });
    }
  }

  public onSimulationCompleted(callback: (result: any) => void): void {
    if (this.connection) {
      this.connection.on('SimulationCompleted', (result) => {
        callback(result);
      });
    }
  }

  private async ensureConnection(): Promise<void> {
    if (!this.connection || this.connection.state !== signalR.HubConnectionState.Connected) {
      await this.startConnection();
    }
  }

  public async stopConnection(): Promise<void> {
    if (this.connection) {
      await this.connection.stop();
      this.connection = null;
    }
  }
}

export const signalrService = new SignalRService();