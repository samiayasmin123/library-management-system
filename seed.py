import argparse
from app.database.seeder import book_seeder


def main():
    parser = argparse.ArgumentParser(description="A Simple seed command cli")

    parser.add_argument(
        "-t",
        "--table",
        type=str,
        default="book"
    )

    args = parser.parse_args()

    if args.table == "book":
        print("seeding books...")
        book_seeder()
    else:
        print("No table found for:", args.table)


if __name__ == "__main__":
    main()