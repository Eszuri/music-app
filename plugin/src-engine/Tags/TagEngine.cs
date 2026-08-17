namespace Symvonia.Engine;

public static class TagEngine
{
    public static (bool Success, string? Error) WriteTags(string filePath, Protocol.TagsDto? tags, Protocol.ArtworkDto? artwork)
    {
        if (string.IsNullOrWhiteSpace(filePath) || !File.Exists(filePath))
        {
            return (false, "File not found");
        }

        try
        {
            using var file = TagLib.File.Create(filePath);
            var tag = file.Tag;

            if (tags != null)
            {
                if (tags.Title != null) tag.Title = tags.Title;
                if (tags.Artist != null) tag.Performers = string.IsNullOrWhiteSpace(tags.Artist) ? [] : [tags.Artist];
                if (tags.Album != null) tag.Album = tags.Album;
                if (tags.Genre != null) tag.Genres = string.IsNullOrWhiteSpace(tags.Genre) ? [] : [tags.Genre];
                if (tags.Year.HasValue) tag.Year = tags.Year.Value;
                if (tags.TrackNumber.HasValue) tag.Track = tags.TrackNumber.Value;
                if (tags.TotalTracks.HasValue) tag.TrackCount = tags.TotalTracks.Value;
                if (tags.DiscNumber.HasValue) tag.Disc = tags.DiscNumber.Value;
                if (tags.TotalDiscs.HasValue) tag.DiscCount = tags.TotalDiscs.Value;
                if (tags.Comment != null) tag.Comment = tags.Comment;
            }

            if (artwork != null)
            {
                if (artwork.Action == "remove")
                {
                    tag.Pictures = [];
                }
                else if (artwork.Action == "set" && !string.IsNullOrWhiteSpace(artwork.DataBase64))
                {
                    byte[] bytes = Convert.FromBase64String(artwork.DataBase64);
                    var pic = new TagLib.Picture(new TagLib.ByteVector(bytes))
                    {
                        Type = TagLib.PictureType.FrontCover,
                        MimeType = string.IsNullOrWhiteSpace(artwork.Mime) ? "image/jpeg" : artwork.Mime,
                        Description = "Front Cover"
                    };
                    tag.Pictures = [pic];
                }
            }

            file.Save();
            return (true, null);
        }
        catch (Exception ex)
        {
            return (false, ex.Message);
        }
    }
}
