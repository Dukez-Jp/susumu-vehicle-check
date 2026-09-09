using Susumu.Api.Configuration;
using Susumu.Api.Endpoints;

var builder = WebApplication.CreateBuilder(args);

builder.AddSusumuConfiguration();
builder.AddSusumuServices();

var app = builder.Build();

if (ProvisioningCommand.IsRequested(args))
{
    return await ProvisioningCommand.RunAsync(app);
}

// Only rewrites the peer address for proxies listed in Network:TrustedProxies; with none configured
// the middleware is not registered and an arbitrary X-Forwarded-For is ignored.
app.UseForwardedHeaders();

app.UseExceptionHandler();
app.UseStatusCodePages(ProblemResponses.WriteAsync);

app.UseAuthentication();
app.UseAuthorization();

app.MapSusumuEndpoints();

if (app.Environment.IsDevelopment())
{
    app.MapOpenApi().AllowAnonymous();
    app.UseSwaggerUI(options =>
    {
        options.SwaggerEndpoint("/openapi/v1.json", "SUSUMU Vehicle Check API v1");
        options.RoutePrefix = "swagger";
    });
}

await app.RunAsync();
return 0;

/// <summary>Exposed so the integration test host can boot the real application.</summary>
public partial class Program;
