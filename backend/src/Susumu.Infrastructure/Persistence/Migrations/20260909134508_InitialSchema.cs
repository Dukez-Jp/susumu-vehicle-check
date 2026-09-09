using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Susumu.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class InitialSchema : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "audit_log",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    ActorId = table.Column<Guid>(type: "uuid", nullable: true),
                    CompanyId = table.Column<Guid>(type: "uuid", nullable: true),
                    Action = table.Column<string>(type: "character varying(80)", maxLength: 80, nullable: false),
                    EntityType = table.Column<string>(type: "character varying(80)", maxLength: 80, nullable: false),
                    EntityId = table.Column<Guid>(type: "uuid", nullable: true),
                    InspectionId = table.Column<Guid>(type: "uuid", nullable: true),
                    At = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    Details = table.Column<string>(type: "character varying(2000)", maxLength: 2000, nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_audit_log", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "companies",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    Name = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: false),
                    Active = table.Column<bool>(type: "boolean", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_companies", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "devices",
                columns: table => new
                {
                    DeviceId = table.Column<string>(type: "character varying(120)", maxLength: 120, nullable: false),
                    LastUserId = table.Column<Guid>(type: "uuid", nullable: true),
                    FirstSeenAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    LastSeenAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_devices", x => x.DeviceId);
                });

            migrationBuilder.CreateTable(
                name: "sync_operations",
                columns: table => new
                {
                    OperationId = table.Column<Guid>(type: "uuid", nullable: false),
                    UserId = table.Column<Guid>(type: "uuid", nullable: false),
                    DeviceId = table.Column<string>(type: "character varying(120)", maxLength: 120, nullable: false),
                    PayloadHash = table.Column<string>(type: "character varying(64)", maxLength: 64, nullable: false),
                    InspectionId = table.Column<Guid>(type: "uuid", nullable: false),
                    ResponseJson = table.Column<string>(type: "text", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_sync_operations", x => x.OperationId);
                });

            migrationBuilder.CreateTable(
                name: "checklist_templates",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    CompanyId = table.Column<Guid>(type: "uuid", nullable: false),
                    Name = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: false),
                    VehicleType = table.Column<string>(type: "character varying(80)", maxLength: 80, nullable: false),
                    Version = table.Column<int>(type: "integer", nullable: false),
                    Published = table.Column<bool>(type: "boolean", nullable: false),
                    RequiresSignature = table.Column<bool>(type: "boolean", nullable: false),
                    PublishedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    CreatedByUserId = table.Column<Guid>(type: "uuid", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_checklist_templates", x => x.Id);
                    table.ForeignKey(
                        name: "FK_checklist_templates_companies_CompanyId",
                        column: x => x.CompanyId,
                        principalTable: "companies",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "locations",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    CompanyId = table.Column<Guid>(type: "uuid", nullable: false),
                    Name = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: false),
                    Active = table.Column<bool>(type: "boolean", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_locations", x => x.Id);
                    table.ForeignKey(
                        name: "FK_locations_companies_CompanyId",
                        column: x => x.CompanyId,
                        principalTable: "companies",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "checklist_sections",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    TemplateId = table.Column<Guid>(type: "uuid", nullable: false),
                    Title = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: false),
                    OrderIndex = table.Column<int>(type: "integer", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_checklist_sections", x => x.Id);
                    table.ForeignKey(
                        name: "FK_checklist_sections_checklist_templates_TemplateId",
                        column: x => x.TemplateId,
                        principalTable: "checklist_templates",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "users",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    CompanyId = table.Column<Guid>(type: "uuid", nullable: false),
                    LocationId = table.Column<Guid>(type: "uuid", nullable: false),
                    Name = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: false),
                    Username = table.Column<string>(type: "character varying(120)", maxLength: 120, nullable: false),
                    PasswordHash = table.Column<string>(type: "character varying(400)", maxLength: 400, nullable: false),
                    Role = table.Column<string>(type: "character varying(32)", maxLength: 32, nullable: false),
                    Active = table.Column<bool>(type: "boolean", nullable: false),
                    SecurityStamp = table.Column<string>(type: "character varying(64)", maxLength: 64, nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_users", x => x.Id);
                    table.ForeignKey(
                        name: "FK_users_companies_CompanyId",
                        column: x => x.CompanyId,
                        principalTable: "companies",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_users_locations_LocationId",
                        column: x => x.LocationId,
                        principalTable: "locations",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "vehicles",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    CompanyId = table.Column<Guid>(type: "uuid", nullable: false),
                    LocationId = table.Column<Guid>(type: "uuid", nullable: false),
                    InternalNumber = table.Column<string>(type: "character varying(40)", maxLength: 40, nullable: false),
                    Plate = table.Column<string>(type: "character varying(40)", maxLength: 40, nullable: true),
                    Type = table.Column<string>(type: "character varying(80)", maxLength: 80, nullable: false),
                    CurrentOdometerKm = table.Column<int>(type: "integer", nullable: true),
                    Active = table.Column<bool>(type: "boolean", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_vehicles", x => x.Id);
                    table.ForeignKey(
                        name: "FK_vehicles_companies_CompanyId",
                        column: x => x.CompanyId,
                        principalTable: "companies",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_vehicles_locations_LocationId",
                        column: x => x.LocationId,
                        principalTable: "locations",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "checklist_items",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    SectionId = table.Column<Guid>(type: "uuid", nullable: false),
                    Label = table.Column<string>(type: "character varying(300)", maxLength: 300, nullable: false),
                    ResponseType = table.Column<string>(type: "character varying(32)", maxLength: 32, nullable: false),
                    Required = table.Column<bool>(type: "boolean", nullable: false),
                    Unit = table.Column<string>(type: "character varying(40)", maxLength: 40, nullable: true),
                    MinValue = table.Column<decimal>(type: "numeric(18,4)", precision: 18, scale: 4, nullable: true),
                    MaxValue = table.Column<decimal>(type: "numeric(18,4)", precision: 18, scale: 4, nullable: true),
                    OrderIndex = table.Column<int>(type: "integer", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_checklist_items", x => x.Id);
                    table.ForeignKey(
                        name: "FK_checklist_items_checklist_sections_SectionId",
                        column: x => x.SectionId,
                        principalTable: "checklist_sections",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "inspections",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    CompanyId = table.Column<Guid>(type: "uuid", nullable: false),
                    LocationId = table.Column<Guid>(type: "uuid", nullable: false),
                    VehicleId = table.Column<Guid>(type: "uuid", nullable: false),
                    TemplateId = table.Column<Guid>(type: "uuid", nullable: false),
                    TemplateVersion = table.Column<int>(type: "integer", nullable: false),
                    DeviceId = table.Column<string>(type: "character varying(120)", maxLength: 120, nullable: false),
                    OdometerKm = table.Column<int>(type: "integer", nullable: false),
                    State = table.Column<string>(type: "character varying(32)", maxLength: 32, nullable: false),
                    StartedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    FinalizedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    Notes = table.Column<string>(type: "character varying(4000)", maxLength: 4000, nullable: true),
                    SupersedesInspectionId = table.Column<Guid>(type: "uuid", nullable: true),
                    CorrectionReason = table.Column<string>(type: "character varying(1000)", maxLength: 1000, nullable: true),
                    Version = table.Column<int>(type: "integer", nullable: false),
                    CreatedByUserId = table.Column<Guid>(type: "uuid", nullable: false),
                    ReceivedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_inspections", x => x.Id);
                    table.ForeignKey(
                        name: "FK_inspections_checklist_templates_TemplateId",
                        column: x => x.TemplateId,
                        principalTable: "checklist_templates",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_inspections_inspections_SupersedesInspectionId",
                        column: x => x.SupersedesInspectionId,
                        principalTable: "inspections",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_inspections_users_CreatedByUserId",
                        column: x => x.CreatedByUserId,
                        principalTable: "users",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_inspections_vehicles_VehicleId",
                        column: x => x.VehicleId,
                        principalTable: "vehicles",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "inspection_items",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    InspectionId = table.Column<Guid>(type: "uuid", nullable: false),
                    ItemId = table.Column<Guid>(type: "uuid", nullable: false),
                    Status = table.Column<string>(type: "character varying(32)", maxLength: 32, nullable: false),
                    Value = table.Column<decimal>(type: "numeric(18,4)", precision: 18, scale: 4, nullable: true),
                    Notes = table.Column<string>(type: "character varying(2000)", maxLength: 2000, nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_inspection_items", x => x.Id);
                    table.ForeignKey(
                        name: "FK_inspection_items_inspections_InspectionId",
                        column: x => x.InspectionId,
                        principalTable: "inspections",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "photos",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    InspectionId = table.Column<Guid>(type: "uuid", nullable: false),
                    ItemId = table.Column<Guid>(type: "uuid", nullable: true),
                    Kind = table.Column<string>(type: "character varying(32)", maxLength: 32, nullable: false),
                    OriginalPhotoId = table.Column<Guid>(type: "uuid", nullable: true),
                    ContentType = table.Column<string>(type: "character varying(120)", maxLength: 120, nullable: true),
                    Sha256 = table.Column<string>(type: "character varying(64)", maxLength: 64, nullable: true),
                    SizeBytes = table.Column<long>(type: "bigint", nullable: true),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    Uploaded = table.Column<bool>(type: "boolean", nullable: false),
                    UploadedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    StoragePath = table.Column<string>(type: "character varying(400)", maxLength: 400, nullable: true),
                    DeclaredByUserId = table.Column<Guid>(type: "uuid", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_photos", x => x.Id);
                    table.ForeignKey(
                        name: "FK_photos_inspections_InspectionId",
                        column: x => x.InspectionId,
                        principalTable: "inspections",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_photos_photos_OriginalPhotoId",
                        column: x => x.OriginalPhotoId,
                        principalTable: "photos",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateIndex(
                name: "IX_audit_log_CompanyId_At",
                table: "audit_log",
                columns: new[] { "CompanyId", "At" });

            migrationBuilder.CreateIndex(
                name: "IX_audit_log_InspectionId",
                table: "audit_log",
                column: "InspectionId");

            migrationBuilder.CreateIndex(
                name: "IX_checklist_items_SectionId",
                table: "checklist_items",
                column: "SectionId");

            migrationBuilder.CreateIndex(
                name: "IX_checklist_sections_TemplateId",
                table: "checklist_sections",
                column: "TemplateId");

            migrationBuilder.CreateIndex(
                name: "IX_checklist_templates_CompanyId_VehicleType_Name_Version",
                table: "checklist_templates",
                columns: new[] { "CompanyId", "VehicleType", "Name", "Version" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_companies_Name",
                table: "companies",
                column: "Name",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_inspection_items_InspectionId_ItemId",
                table: "inspection_items",
                columns: new[] { "InspectionId", "ItemId" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_inspections_CompanyId_LocationId_State",
                table: "inspections",
                columns: new[] { "CompanyId", "LocationId", "State" });

            migrationBuilder.CreateIndex(
                name: "IX_inspections_CreatedByUserId",
                table: "inspections",
                column: "CreatedByUserId");

            migrationBuilder.CreateIndex(
                name: "IX_inspections_SupersedesInspectionId",
                table: "inspections",
                column: "SupersedesInspectionId");

            migrationBuilder.CreateIndex(
                name: "IX_inspections_TemplateId",
                table: "inspections",
                column: "TemplateId");

            migrationBuilder.CreateIndex(
                name: "IX_inspections_VehicleId_StartedAt",
                table: "inspections",
                columns: new[] { "VehicleId", "StartedAt" });

            migrationBuilder.CreateIndex(
                name: "IX_locations_CompanyId_Name",
                table: "locations",
                columns: new[] { "CompanyId", "Name" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_photos_InspectionId_Uploaded",
                table: "photos",
                columns: new[] { "InspectionId", "Uploaded" });

            migrationBuilder.CreateIndex(
                name: "IX_photos_OriginalPhotoId",
                table: "photos",
                column: "OriginalPhotoId");

            migrationBuilder.CreateIndex(
                name: "IX_sync_operations_InspectionId",
                table: "sync_operations",
                column: "InspectionId");

            migrationBuilder.CreateIndex(
                name: "IX_users_CompanyId_LocationId",
                table: "users",
                columns: new[] { "CompanyId", "LocationId" });

            migrationBuilder.CreateIndex(
                name: "IX_users_LocationId",
                table: "users",
                column: "LocationId");

            migrationBuilder.CreateIndex(
                name: "IX_users_Username",
                table: "users",
                column: "Username",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_vehicles_CompanyId_InternalNumber",
                table: "vehicles",
                columns: new[] { "CompanyId", "InternalNumber" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_vehicles_CompanyId_Plate",
                table: "vehicles",
                columns: new[] { "CompanyId", "Plate" });

            migrationBuilder.CreateIndex(
                name: "IX_vehicles_LocationId",
                table: "vehicles",
                column: "LocationId");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "audit_log");

            migrationBuilder.DropTable(
                name: "checklist_items");

            migrationBuilder.DropTable(
                name: "devices");

            migrationBuilder.DropTable(
                name: "inspection_items");

            migrationBuilder.DropTable(
                name: "photos");

            migrationBuilder.DropTable(
                name: "sync_operations");

            migrationBuilder.DropTable(
                name: "checklist_sections");

            migrationBuilder.DropTable(
                name: "inspections");

            migrationBuilder.DropTable(
                name: "checklist_templates");

            migrationBuilder.DropTable(
                name: "users");

            migrationBuilder.DropTable(
                name: "vehicles");

            migrationBuilder.DropTable(
                name: "locations");

            migrationBuilder.DropTable(
                name: "companies");
        }
    }
}
