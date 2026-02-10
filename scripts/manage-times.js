import supabase from "../config/supabase.js";

const action = process.argv[2];
const args = process.argv.slice(3);

async function addTime(startTime) {
    const { data, error } = await supabase.from("available_times").insert([{ start_time: startTime }]);
    if (error) {
        console.error("Error adding time:", error.message);
    } else {
        console.log(`Successfully added time: ${startTime}`);
    }
}

async function listTimes() {
    const { data, error } = await supabase
        .from("available_times")
        .select("*")
        .order("start_time", { ascending: true });

    if (error) {
        console.error("Error fetching times:", error.message);
    } else {
        console.table(data.map(t => ({
            id: t.id,
            start_time: new Date(t.start_time).toLocaleString('sv-SE'),
            is_booked: t.is_booked
        })));
    }
}

async function deleteTime(id) {
    const { error } = await supabase.from("available_times").delete().eq("id", id).eq("is_booked", false);
    if (error) {
        console.error("Error deleting time:", error.message);
    } else {
        console.log(`Successfully deleted time with ID: ${id} (if it was not booked)`);
    }
}

async function main() {
    switch (action) {
        case "add":
            if (args.length === 0) {
                console.log("Usage: node scripts/manage-times.js add \"2025-02-15 10:00\" [\"2025-02-15 11:00\" ...]");
                return;
            }
            for (const time of args) {
                await addTime(time);
            }
            break;
        case "list":
            await listTimes();
            break;
        case "delete":
            if (args.length === 0) {
                console.log("Usage: node scripts/manage-times.js delete <id>");
                return;
            }
            await deleteTime(args[0]);
            break;
        default:
            console.log("Available commands: add, list, delete");
            console.log("Example: node scripts/manage-times.js list");
            console.log("Example: node scripts/manage-times.js add \"2025-02-15 10:00\"");
    }
}

main();
