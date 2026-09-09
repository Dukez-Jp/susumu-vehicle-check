using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Susumu.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class TemplateAvailabilityAndSignature : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<Guid>(
                name: "SignaturePhotoId",
                table: "inspections",
                type: "uuid",
                nullable: true);

            migrationBuilder.AddColumn<bool>(
                name: "Active",
                table: "checklist_templates",
                type: "boolean",
                nullable: false,
                defaultValue: false);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "SignaturePhotoId",
                table: "inspections");

            migrationBuilder.DropColumn(
                name: "Active",
                table: "checklist_templates");
        }
    }
}
