---
title: Remote File Monitors | Kener
description: Learn how to set up and work with Remote File monitors in Kener.
---

# Remote File Monitors

Remote File monitors are used to monitor files on servers using protocols like FTP, SFTP, etc. You can verify file server uptime and the contents of remote folders.

<div class="border rounded-md">

![Remote Files Monitor](/documentation/m_remotefiles.png)

</div>

## Timeout

<span class="text-red-500 text-xs font-semibold">
	REQUIRED
</span>

The `timeout` property defines the maximum time in milliseconds to wait for a response from the server. If the monitor does not respond within this period, it will be marked as down. For example, a value of `5000` sets the timeout to 5 seconds. This is a required field and must be a number greater than 0.

## Server URL

<span class="text-red-500 text-xs font-semibold">
	REQUIRED
</span>

The Server URL expects a value compatible with the [WHATWG URL Standard](https://url.spec.whatwg.org/). It is used to extract the protocol and connection properties based on the following rules:

- Supported protocols are `ftp`, `ftps` (for secure FTP), and `sftp`.
- The `ftp` protocol is plain text (insecure).
- The `ftps` protocol uses TLS and accepts the following parameters:
  - `secure`: Controls how the TLS connection is established. Accepted values are `implicit` and `required` (default).
  - `rejectUnauthorized`: Controls whether to verify the authenticity of the peer's SSL/TLS certificate. It accepts a boolean value, with `true` as the default.
- The `sftp` protocol accepts the `privateKey` and `passphrase` parameters.

If a `pathname` is present and is not `/`, the contents of that path will be listed and provided to the `eval` function. A `pathname` of `/` is ignored.

Examples:
- **ftp://user:pass@127.0.0.1**: Connects to an FTP server at `127.0.0.1` on the default port (21) using plain FTP. Does not list any files.
- **ftps://user:pass@127.0.0.1:2221**: Connects to an FTP server at `127.0.0.1` on port 2221, requiring explicit TLS over FTP. Does not list any files.
- **ftps://user:pass@127.0.0.1:2221/uploads?secure=implicit&rejectUnauthorized=false**: Connects to an FTP server at `127.0.0.1` on port 2221, requiring implicit TLS over FTP, and lists the content of the `/uploads` folder.
- **sftp://user:$MY_PASSWORD@127.0.0.1**: Connects to an SFTP server at `127.0.0.1` on the default port (22), authenticating with the username `user` and a password defined as the monitor secret `MY_PASSWORD`. Does not list any files.
- **sftp://127.0.0.1:2222/uploads?passKey=$MY_PRIVATE_KEY**: Connects to an SFTP server at `127.0.0.1` on port 2222, authenticating with a private key defined as monitor secret `MY_PRIVATE_KEY`, and lists the content of the `/uploads` folder.

## Monitor Secrets

To secure sensitive information, you can add one or more Monitor Secrets and reference them in your [Server URL](#server-url).

Monitor Secrets are named values whose contents are looked up from environment variables. If the environment variable name ends with '_FILE', then it is assumed that the environment variable value contains the path to a file holding the secret.

For example, to protect a password, you can add a secret named `MY_FTP_PASSWORD` and reference it in the URL by prefixing the secret name with a `$` sign, like this: `ftps://username:$MY_FTP_PASSWORD@server:2221/`. Alternatively, if the secret is stored in a file, you can define an environment variable named `MY_FTP_PASSWORD_FILE` containing the path to the file with the secret. For instance, if `MY_FTP_PASSWORD_FILE` is set to `/etc/secrets/ftp_pass.txt`, the content of that file will be used as the value for `$MY_FTP_PASSWORD` in the URL.

## Extra Folders

You can specify additional folders to be monitored. After connecting to the server, the monitor will list the content of each folder (non-recursively), and the combined results will be passed to the `eval` function in the `files` argument.

For example:
- Add `.` to list the contents of the current folder after login.
- Add `/` to list the contents of the file server's root folder.

## Eval

The `eval` property defines the JavaScript code used to evaluate the monitor's response. It is optional and must be valid JavaScript.

This is an anonymous JavaScript function that must return a **Promise**. The promise should resolve with an object containing `status` and `latency`. By default, it looks like this:

> **_NOTE:_** The `eval` function should always return a JSON object. The JSON object must have a `status` (UP/DOWN/DEGRADED) and a `latency` (number) property.
> `{status:"DEGRADED", latency: 200}`.

```javascript
(async function (connectionTime, listingTime, files) {
	return {
		status: 'DOWN',
		latency: connectionTime + listingTime,
	}
})
```
- `connectionTime` **REQUIRED** (number): The latency in milliseconds for the connection and authentication.
- `listingTime` **REQUIRED** (number): The latency in milliseconds to list the folder contents.
- `files` **REQUIRED** (array): An array of `IFileInfo` objects containing information about the folder contents. Folder contents are listed non-recursively.

```javascript
class IFileInfo {
  constructor(name, type, size, modifyTime, folder) {
    this.name = name; // file name
    this.type = type; // "d" for directory or "f" for file
    this.size = size; // size in bytes
    this.modifyTime = modifyTime; // epoch, milliseconds since January 1, 1970, UTC. Not all FTP servers provide it.
    this.folder = folder; // the remote folder
  }
}
``
