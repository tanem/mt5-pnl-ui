interface FileSystemHandlePermissionDescriptor {
  mode?: "read" | "readwrite";
}

interface FileSystemFileHandle {
  queryPermission(
    d?: FileSystemHandlePermissionDescriptor,
  ): Promise<PermissionState>;
  requestPermission(
    d?: FileSystemHandlePermissionDescriptor,
  ): Promise<PermissionState>;
}

interface Window {
  showOpenFilePicker?(options?: {
    types?: { description?: string; accept: Record<string, string[]> }[];
    multiple?: boolean;
  }): Promise<FileSystemFileHandle[]>;
}
