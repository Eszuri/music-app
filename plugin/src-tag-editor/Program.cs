using System.Runtime.InteropServices;
using Symvonia.TagEditor;

[DllImport("kernel32.dll", SetLastError = true)]
static extern IntPtr GetStdHandle(int nStdHandle);

try
{
    IntPtr hOut = GetStdHandle(-11);
    if (hOut != IntPtr.Zero && hOut != new IntPtr(-1))
    {
        var outStream = new FileStream(new Microsoft.Win32.SafeHandles.SafeFileHandle(hOut, false), FileAccess.Write, 4096);
        Console.SetOut(new StreamWriter(outStream, new System.Text.UTF8Encoding(false)) { AutoFlush = true });
    }
}
catch { }

try
{
    IntPtr hIn = GetStdHandle(-10);
    if (hIn != IntPtr.Zero && hIn != new IntPtr(-1))
    {
        var inStream = new FileStream(new Microsoft.Win32.SafeHandles.SafeFileHandle(hIn, false), FileAccess.Read, 4096);
        Console.SetIn(new StreamReader(inStream, System.Text.Encoding.UTF8));
    }
}
catch { }

if (args.Length >= 2 && args[0] == "--verify")
{
    Protocol.EmitVerify(args[1]);
    return;
}

Protocol.EmitReady();

string? line;
while ((line = Console.ReadLine()) != null)
{
    if (string.IsNullOrWhiteSpace(line)) continue;
    var cmd = Protocol.ParseCommand(line);
    if (cmd == null || string.IsNullOrEmpty(cmd.Name)) continue;

    switch (cmd.Name)
    {
        case "ping":
            Protocol.EmitSimple("pong");
            break;

        case "write_tags":
            {
                if (string.IsNullOrWhiteSpace(cmd.FilePath))
                {
                    Protocol.EmitWriteResult("", false, "File path is required");
                    break;
                }
                var (success, error) = TagEngine.WriteTags(cmd.FilePath, cmd.Tags, cmd.Artwork);
                Protocol.EmitWriteResult(cmd.FilePath, success, error);
                break;
            }

        case "shutdown":
            Protocol.EmitSimple("bye");
            return;
    }
}
