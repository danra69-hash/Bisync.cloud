namespace Bisync.Api.Services;

public static class StockCardArchivePaths
{
    public const string DefaultFolderName = "stock-card";
    public const string ArchiveFileName = "archive.db";

    public static string ResolveArchiveDirectory(IConfiguration configuration, IHostEnvironment environment)
    {
        var configured = configuration[$"{StockCardArchiveOptions.SectionName}:Directory"];
        if (!string.IsNullOrWhiteSpace(configured))
            return Path.GetFullPath(configured.Trim());

        var repoArchive = Path.GetFullPath(Path.Combine(
            environment.ContentRootPath,
            "..",
            "..",
            "data-archives",
            DefaultFolderName));

        if (Directory.Exists(Path.GetDirectoryName(repoArchive)!) || environment.IsDevelopment())
            return repoArchive;

        return Path.Combine(environment.ContentRootPath, "data-archives", DefaultFolderName);
    }

    public static string ResolveArchiveDatabasePath(IConfiguration configuration, IHostEnvironment environment)
        => Path.Combine(ResolveArchiveDirectory(configuration, environment), ArchiveFileName);
}
